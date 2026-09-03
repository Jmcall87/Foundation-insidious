/*
 * Selfhost Portal — deploy engine + chat/VM gateway
 * Backend-agnostic: talks to the Docker socket (runs under Cosmos Cloud or Casa OS).
 */
const express = require("express");
const session = require("express-session");
const http = require("http");
const path = require("path");

const { run: runAgent } = require('./harness/agent');
const mcp = require('./harness/mcp');

const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
}));

// ---------- auth (multi-user) ----------
const users = require('./harness/users');
users.ensureInit();

app.post("/api/login", (req, res) => {
  const u = users.authenticate(req.body.username, req.body.password);
  if (!u) return res.status(401).json({ ok: false, error: "wrong username or password" });
  req.session.authed = true;
  req.session.user = u;
  res.json({ ok: true, user: u });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.authed) return res.status(401).json({ error: "login required" });
  res.json({ user: req.session.user });
});

// admin-only guard for /api/admin/*
app.use("/api/admin", (req, res, next) => {
  if (!req.session.authed || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "admin only" });
  }
  next();
});

app.get("/api/admin/users", (req, res) => res.json(users.list()));
app.post("/api/admin/users", (req, res) => {
  try { res.json({ ok: true, user: users.add(req.body.username, req.body.password, req.body.role) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/admin/users/:name", (req, res) => {
  try { users.remove(req.params.name); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/admin/users/:name/password", (req, res) => {
  try { users.changePassword(req.params.name, req.body.password); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/admin/users/:name/role", (req, res) => {
  try { users.setRole(req.params.name, req.body.role); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && !req.session.authed) {
    return res.status(401).json({ error: "login required" });
  }
  next();
});

// public landing page at /, dashboard at /app
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/app", (req, res) => res.sendFile(path.join(__dirname, "public", "app.html")));
app.use(express.static(path.join(__dirname, "public")));

// ---------- app catalog ----------
const APPS = {
  windows: {
    name: "Windows VM",
    image: "dockurr/windows:latest",
    port: "8006/tcp",
    hostPort: 8006,
    heavy: true,
    extraEnv: { VERSION: "11", RAM_SIZE: "4G", CPU_CORES: "4", DISK_SIZE: "64G" },
  },
  reactos: {
    name: "ReactOS (FOSS Windows)",
    image: "dockurr/reactos:latest",
    port: "8006/tcp",
    hostPort: 8007,
    extraEnv: {},
  },
  neko: {
    name: "Browser in Browser",
    image: "m1k1o/neko:firefox",
    port: "8080/tcp",
    hostPort: 8081,
    extraEnv: {
      NEKO_SCREEN: "1920x1080@30",
      NEKO_PASSWORD: process.env.NEKO_USER_PASS || "neko",
      NEKO_PASSWORD_ADMIN: process.env.NEKO_ADMIN_PASS || "admin",
      NEKO_EPR: "52000-52100",
    },
  },
  terminal: {
    name: "Web Terminal",
    image: "tsl0922/ttyd:latest",
    port: "7681/tcp",
    hostPort: 7681,
    extraEnv: {},
  },
};

// ---------- docker engine ----------
let docker = null;
function getDocker() {
  if (!docker) {
    const Docker = require("dockerode");
    docker = new Docker({ socketPath: process.env.DOCKER_HOST || "/var/run/docker.sock" });
  }
  return docker;
}

const host = () => process.env.PUBLIC_HOST || "localhost";

async function containerState(id) {
  try {
    const c = await getDocker().getContainer("portal-" + id).inspect();
    return c.State.Running ? "running" : "stopped";
  } catch (_) { return "stopped"; }
}

// ---------- routes ----------
app.get("/api/apps", async (req, res) => {
  const out = [];
  for (const [id, app] of Object.entries(APPS)) {
    const state = await containerState(id);
    out.push({ id, name: app.name, state, url: `http://${host()}:${app.hostPort}` });
  }
  res.json(out);
});

app.post("/api/apps/:id/deploy", async (req, res) => {
  const app = APPS[req.params.id];
  if (!app) return res.status(404).json({ error: "unknown app" });
  const name = "portal-" + req.params.id;
  try {
    const d = getDocker();

    // remove leftovers
    try { const old = d.getContainer(name); await old.remove({ force: true }); } catch (_) {}

    // pull image (await full pull so we know it exists)
    const stream = await d.pull(app.image);
    await new Promise((resolve, reject) => {
      d.modem.followProgress(stream, (err) => err ? reject(err) : resolve());
    });

    const env = Object.entries(app.extraEnv).map(([k, v]) => `${k}=${v}`);
    const container = await d.createContainer({
      name,
      Image: app.image,
      Env: env,
      HostConfig: {
        PortBindings: { [app.port]: [{ HostPort: String(app.hostPort) }] },
        RestartPolicy: { Name: "unless-stopped" },
        ExtraHosts: [],
        ...(app.heavy ? { Devices: [{ PathOnHost: "/dev/kvm", PathInContainer: "/dev/kvm", CgroupPermissions: "mrw" }] } : {}),
        CapAdd: app.heavy ? ["NET_ADMIN"] : [],
        ShmSize: req.params.id === "neko" ? 2 * 1024 * 1024 * 1024 : undefined,
      },
    });
    await container.start();
    res.json({ ok: true, url: `http://${host()}:${app.hostPort}` });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/apps/:id/stop", async (req, res) => {
  try {
    await getDocker().getContainer("portal-" + req.params.id).stop();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/apps/:id/remove", async (req, res) => {
  try {
    const c = getDocker().getContainer("portal-" + req.params.id);
    try { await c.stop(); } catch (_) {}
    await c.remove();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- publish destinations ----------
const publish = require('./harness/publish');
const DEST_FILE = process.env.PUBLISH_DEST_FILE || path.join(process.env.DATA_DIR || '/data/selfhost-portal/data', 'publish-destinations.json');

app.get("/api/publish/destinations", (req, res) => res.json(publish.listDestinations()));

app.post("/api/publish/destinations", (req, res) => {
  const { name, type, site, user, appPassword, adminKey, repo, branch, pathTemplate, baseUrl, token, url, bearerToken, headers } = req.body || {};
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  const fs = require('fs');
  let all = {};
  try { all = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8')); } catch {}
  all[name] = { type, site, user, appPassword, adminKey, repo, branch, pathTemplate, baseUrl, token, url, bearerToken, headers };
  fs.mkdirSync(path.dirname(DEST_FILE), { recursive: true });
  fs.writeFileSync(DEST_FILE, JSON.stringify(all, null, 2));
  res.json({ ok: true, name, destinations: publish.listDestinations() });
});

app.delete("/api/publish/destinations/:name", (req, res) => {
  const fs = require('fs');
  let all = {};
  try { all = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8')); } catch {}
  if (!all[req.params.name]) return res.status(404).json({ error: 'not found' });
  delete all[req.params.name];
  fs.writeFileSync(DEST_FILE, JSON.stringify(all, null, 2));
  res.json({ ok: true, destinations: publish.listDestinations() });
});

// ---------- chat ----------
const chatLog = [];

app.get("/api/chat", (req, res) => res.json(chatLog.slice(-100)));

app.post("/api/chat", async (req, res) => {
  const text = String(req.body.text || "").trim();
  const t = text.toLowerCase();
  let reply = null;
  let action = null;
  let entry2 = null;

  if (t === "help") {
    reply = "Commands: status | deploy <app> | stop <app> | open <app>\nApps: " + Object.keys(APPS).join(", ");
  } else if (t === "status") {
    const parts = [];
    for (const [id, a] of Object.entries(APPS)) parts.push(`${a.name}: ${await containerState(id)}`);
    reply = parts.join("\n");
  } else if (t.startsWith("deploy ")) {
    const id = t.slice(7).trim();
    if (APPS[id]) { action = { type: "deploy", id }; reply = `Deploying ${APPS[id].name}… (first pull takes a while)`; }
    else reply = `Unknown app "${id}". Apps: ${Object.keys(APPS).join(", ")}`;
  } else if (t.startsWith("stop ")) {
    const id = t.slice(5).trim();
    if (APPS[id]) { action = { type: "stop", id }; reply = `Stopping ${APPS[id].name}…`; }
    else reply = `Unknown app "${id}".`;
  } else if (t.startsWith("open ")) {
    const map = { windows: "windows", terminal: "terminal", browser: "neko", reactos: "reactos" };
    const id = map[t.slice(5).trim()];
    reply = id ? `${APPS[id].name}: http://${host()}:${APPS[id].hostPort}` : "Try: open windows | terminal | browser | reactos";
  } else if (process.env.LLM_API_KEY) {
    // natural language -> agent harness (docker control + MCP + publish tools)
    entry2 = { role: 'user', content: text };
    res.status(202).json({ pending: true });
    runAgent(entry2, (chunk) => { chatLog.push(chunk); broadcast && broadcast(chunk); }).then((final) => {
      chatLog.push(final);
    }).catch((e) => chatLog.push({ user: text, reply: '❌ agent error: ' + (e.message || e), ts: Date.now() }));
    return;
  } else {
    reply = "I deploy and control the apps on this site. Type 'help' for commands.";
  }

  const entry = { user: text, reply, ts: Date.now() };
  chatLog.push(entry);

  if (action) {
    try {
      const app = APPS[action.id];
      const name = "portal-" + action.id;
      const d = getDocker();
      if (action.type === "stop") {
        try { await d.getContainer(name).stop(); } catch (_) {}
        entry.reply += " ✅ stopped";
      } else {
        try { const old = d.getContainer(name); await old.remove({ force: true }); } catch (_) {}
        const stream = await d.pull(app.image);
        await new Promise((resolve, reject) => d.modem.followProgress(stream, (err) => err ? reject(err) : resolve()));
        const env = Object.entries(app.extraEnv).map(([k, v]) => `${k}=${v}`);
        const container = await d.createContainer({
          name, Image: app.image, Env: env,
          HostConfig: {
            PortBindings: { [app.port]: [{ HostPort: String(app.hostPort) }] },
            RestartPolicy: { Name: "unless-stopped" },
            ...(app.heavy ? { Devices: [{ PathOnHost: "/dev/kvm", PathInContainer: "/dev/kvm", CgroupPermissions: "mrw" }] } : {}),
            CapAdd: app.heavy ? ["NET_ADMIN"] : [],
          },
        });
        await container.start();
        entry.reply += " ✅ running at http://" + host() + ":" + app.hostPort;
      }
    } catch (e) {
      entry.reply += " ❌ " + (e.message || e);
    }
  }

  res.json(entry);
});

const PORT = process.env.PORT || 8080;
http.createServer(app).listen(PORT, () => console.log(`portal up on :${PORT}`));
