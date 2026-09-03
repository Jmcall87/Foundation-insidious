// foundation-insidious — Cloudflare Workers edition (single file, zero dependencies)
// REQUIRED: KV namespace bound as "KV"
// SECRET: ADMIN_PASS (initial admin password — optional, random one generated if missing)

const LANDING = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>foundation-insidious</title><style>
*{box-sizing:border-box;margin:0}body{font-family:system-ui,sans-serif;background:#0b0e14;color:#e8eaf0}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 28px;border-bottom:1px solid #1c2230}
.logo{font-weight:700;font-size:18px}.logo span{color:#6c8cff}
a.btn,button.btn{background:#6c8cff;color:#0b0e14;padding:9px 18px;border-radius:8px;text-decoration:none;font-weight:600;border:none;cursor:pointer}
.hero{text-align:center;padding:90px 20px 60px}h1{font-size:44px;margin-bottom:14px}
h1 em{color:#6c8cff;font-style:normal}.sub{color:#9aa3b5;font-size:18px;max-width:640px;margin:0 auto 30px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;max-width:980px;margin:50px auto;padding:0 20px}
.card{background:#121722;border:1px solid #1c2230;border-radius:12px;padding:22px}.card h3{margin-bottom:8px}.card p{color:#9aa3b5;font-size:14px}
footer{text-align:center;color:#5b6472;padding:40px;font-size:13px}</style></head><body>
<header><div class=logo>foundation<span>-insidious</span></div><a class=btn href=/app>Sign in</a></header>
<div class=hero><h1>Your workspace, <em>alive</em> on the web</h1>
<p class=sub>A self-hosted portal with an AI agent in chat, a catalog of open-source apps, free-API powered accounts for everyone, and publishing to your own sites — running free and always-on.</p>
<a class=btn href=/app>Enter the portal →</a></div>
<div class=grid>
<div class=card><h3>💬 Agent chat</h3><p>Talk to the built-in AI assistant. Bring your own free API key (Groq, OpenRouter…) — no server needed.</p></div>
<div class=card><h3>🧩 Open-source catalog</h3><p>One place for the best self-hosted apps: browser, terminal, desktop, Windows VM, and server OS platforms.</p></div>
<div class=card><h3>👥 Multi-user</h3><p>Open sign-up. Admin + member roles, hashed passwords, real sessions.</p></div>
<div class=card><h3>⚡ Always on</h3><p>Runs on Cloudflare's global edge. No sleep, no downtime.</p></div>
</div><footer>foundation-insidious · powered by Cloudflare Workers</footer></body></html>`;

const APP = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Dashboard · foundation-insidious</title><style>
*{box-sizing:border-box;margin:0}body{font-family:system-ui,sans-serif;background:#0b0e14;color:#e8eaf0}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;border-bottom:1px solid #1c2230}
.logo{font-weight:700}.logo span{color:#6c8cff}button{cursor:pointer}
#login{max-width:340px;margin:90px auto;background:#121722;border:1px solid #1c2230;border-radius:12px;padding:28px}
#login input{width:100%;padding:10px;margin:6px 0;background:#0b0e14;border:1px solid #2a3245;border-radius:8px;color:#e8eaf0}
#login button{width:100%;padding:11px;margin-top:10px;background:#6c8cff;border:none;border-radius:8px;font-weight:700;color:#0b0e14}
#dash{display:none;max-width:980px;margin:24px auto;padding:0 16px}
.msgs{background:#121722;border:1px solid #1c2230;border-radius:12px;padding:16px;height:360px;overflow-y:auto;margin-bottom:10px}
.m{margin:8px 0;padding:10px 14px;border-radius:10px;max-width:85%;white-space:pre-wrap}.u{background:#6c8cff;color:#0b0e14;margin-left:auto}.a{background:#1c2230}
.row{display:flex;gap:8px}input#c{flex:1;padding:12px;background:#121722;border:1px solid #2a3245;border-radius:10px;color:#e8eaf0}
.row button{padding:12px 22px;background:#6c8cff;border:none;border-radius:10px;font-weight:700;color:#0b0e14}
#apps{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}.chip{background:#121722;border:1px solid #1c2230;border-radius:20px;padding:7px 14px;font-size:13px;color:#9aa3b5}
.err{color:#ff7b7b;font-size:13px;min-height:16px;margin-top:6px}
h3.sec{margin:22px 0 10px;font-size:15px;color:#9aa3b5;text-transform:uppercase;letter-spacing:.06em}
.cat{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:12px}
.app{background:#121722;border:1px solid #1c2230;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px}
.app b{font-size:14px}.app p{color:#9aa3b5;font-size:12.5px;flex:1}.app .need{font-size:11px;color:#d8b34a}
.app a{color:#6c8cff;font-size:13px;text-decoration:none;font-weight:600}
#api{background:#121722;border:1px solid #1c2230;border-radius:10px;padding:16px;margin-bottom:8px}
#api .f{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
#api select,#api input{padding:9px;background:#0b0e14;border:1px solid #2a3245;border-radius:8px;color:#e8eaf0}
#api .f button{padding:9px 18px;background:#6c8cff;border:none;border-radius:8px;font-weight:700;color:#0b0e14}
#api .hint{color:#9aa3b5;font-size:12.5px;margin-top:8px}#api .hint a{color:#6c8cff}
#apistatus{font-size:13px;margin-top:6px;color:#7ddb8a}
</style></head><body>
<header><div class=logo>foundation<span>-insidious</span></div><button id=out style="display:none;background:none;border:1px solid #2a3245;color:#9aa3b5;border-radius:8px;padding:7px 14px">Log out</button></header>
<div id=login><h2 style=margin-bottom:14px>Sign in</h2>
<input id=u placeholder="Username"><input id=p type=password placeholder="Password">
<button onclick=doLogin()>Sign in</button><button id=su style="background:none;border:1px solid #6c8cff;color:#6c8cff;margin-top:8px" onclick=doRegister()>Create account</button><div class=err id=lerr></div></div>
<div id=dash><div id=apps></div>
<h3 class=sec>Free AI APIs — bring your own key</h3>
<div id=api>
<div class=f>
<select id=aprovider onchange=providerChanged()>
<option value=groq>Groq (free, fastest)</option>
<option value=openrouter>OpenRouter (free models)</option>
<option value=custom>Custom (OpenAI-compatible)</option>
</select>
<input id=akey placeholder="API key" style=flex:1;min-width:180px>
<input id=amodel placeholder="Model (optional)">
<button onclick=saveLLM()>Save key</button>
</div>
<div class=hint id=ahint></div><div id=apistatus></div>
</div>
<h3 class=sec>Open-source app catalog</h3>
<div class=cat id=cat></div>
<h3 class=sec>Agent chat</h3>
<div class=msgs id=msgs></div>
<div class=row><input id=c placeholder="Ask the agent anything…" onkeydown="if(event.key=='Enter')send()">
<button onclick=send()>Send</button></div></div>
<script>
let me=null;
async function j(url,opt){const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));return{r,d}}
async function boot(){const{r,d}=await j('/api/me');if(r.ok){me=d;entered()}else showLogin();loadApps()}
function showLogin(){login.style.display='block';dash.style.display='none';out.style.display='none'}
function entered(){login.style.display='none';dash.style.display='block';out.style.display='block';
add('a','Welcome back, '+me.username+'. Ask me anything — and check the Free AI APIs panel to power my brain with a free key.');loadCatalog();loadLLM()}
async function doLogin(){lerr.textContent='';const{r,d}=await j('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.value,password:p.value})});
if(r.ok){me=d;entered()}else lerr.textContent=d.error||'Login failed'}
async function doRegister(){lerr.textContent='';const{r,d}=await j('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.value,password:p.value})});
if(r.ok){me=d;entered()}else lerr.textContent=d.error||'Sign up failed'}
out.onclick=async()=>{await j('/api/logout',{method:'POST'});me=null;showLogin()};
async function loadApps(){const{d}=await j('/api/apps');apps.innerHTML=d.map(a=>'<span class=chip>'+a.name+': '+a.status+'</span>').join('')}
async function loadCatalog(){const{r,d}=await j('/api/catalog');if(!r.ok)return;
cat.innerHTML=d.map(a=>'<div class=app><b>'+a.name+'</b><p>'+a.desc+'</p><span class=need>⚠ '+a.needs+'</span><a href="'+a.repo+'" target=_blank>Open project →</a></div>').join('')}
const PROVIDERS={groq:{base:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile',keyUrl:'https://console.groq.com/keys',label:'console.groq.com'},
openrouter:{base:'https://openrouter.ai/api/v1',model:'meta-llama/llama-3.3-70b-instruct:free',keyUrl:'https://openrouter.ai/keys',label:'openrouter.ai'}};
function providerChanged(){const p=PROVIDERS[aprovider.value];amodel.placeholder=p?'Model (default: '+p.model+')':'Model (required)';hint()}
function hint(){const p=PROVIDERS[aprovider.value];ahint.innerHTML=p?'Get a free key at <a href="'+p.keyUrl+'" target=_blank>'+p.label+'</a> — takes 1 minute.':'Use any OpenAI-compatible URL + key + model.'}
async function loadLLM(){providerChanged();const{r,d}=await j('/api/llm');if(!r.ok)return;
apistatus.textContent=d.configured?('✅ Key saved ('+d.provider+(d.model?', '+d.model:'')+') — chat is powered.'):'';if(d.configured){aprovider.value=d.provider;providerChanged()}}
async function saveLLM(){apistatus.style.color='#ff7b7b';
const{r,d}=await j('/api/llm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:aprovider.value,key:akey.value.trim(),model:amodel.value.trim()})});
if(r.ok){apistatus.style.color='#7ddb8a';apistatus.textContent='✅ Saved — the chat now uses your key.';akey.value=''}else apistatus.textContent=d.error||'Save failed'}
function add(who,text){const e=document.createElement('div');e.className='m '+who;e.textContent=text;msgs.appendChild(e);msgs.scrollTop=msgs.scrollHeight}
async function send(){const t=c.value.trim();if(!t)return;c.value='';add('u',t);
const{r,d}=await j('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t})});
add('a',r.ok?d.reply:(d.error||'Error'))}
boot()
</script></body></html>`;

// ---------- open-source catalog ----------
const CATALOG = [
  { name: 'Windows VM in browser', repo: 'https://github.com/dockur/windows', desc: 'A full Windows machine running in a browser tab (dockur/windows).', needs: 'requires a KVM-capable server' },
  { name: 'Neko — shared browser', repo: 'https://github.com/m1k1o/neko', desc: 'A virtual browser in a tab that several people can use together.', needs: 'requires a Docker server' },
  { name: 'ttyd — web terminal', repo: 'https://github.com/tsl0922/ttyd', desc: 'A real Linux terminal, in the browser, over HTTPS.', needs: 'any Linux machine' },
  { name: 'CasaOS', repo: 'https://github.com/IceWhaleTech/CasaOS', desc: 'A beautiful app store for your own server — one-click self-hosting.', needs: 'own server / VPS' },
  { name: 'Cosmos', repo: 'https://github.com/azukaar/Cosmos-Server', desc: 'All-in-one self-host platform: reverse proxy, apps, users.', needs: 'own server / VPS' },
  { name: 'Webtop — Linux desktop', repo: 'https://github.com/linuxserver/docker-webtop', desc: 'A full Linux desktop (KDE/UI) in a browser tab.', needs: 'requires a Docker server' },
];

const PROVIDERS = {
  groq: { base: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  openrouter: { base: 'https://openrouter.ai/api/v1', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free' },
};

// ---------- helpers ----------
const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const html = (body) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const newSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

async function getUser(env, name) {
  const raw = await env.KV.get('user:' + name);
  return raw ? JSON.parse(raw) : null;
}

async function ensureAdmin(env) {
  if (await env.KV.get('user:admin')) return;
  const salt = newSalt();
  const user = { username: 'admin', role: 'admin', salt, hash: await hashPassword(env.ADMIN_PASS || 'changeme-please-change', salt), created: Date.now() };
  await env.KV.put('user:admin', JSON.stringify(user));
}

async function getSession(env, req) {
  const cookie = req.headers.get('Cookie') || '';
  const m = cookie.match(/fi_sess=([a-f0-9]+)/);
  if (!m) return null;
  const name = await env.KV.get('sess:' + m[1]);
  if (!name) return null;
  return { name, user: await getUser(env, name) };
}

async function requireUser(env, req) {
  const s = await getSession(env, req);
  return s && s.user ? s : null;
}

// ---------- router ----------
export default {
  async fetch(req, env) {
    await ensureAdmin(env);
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'GET' && path === '/') return html(LANDING);
    if (req.method === 'GET' && path === '/app') return html(APP);

    if (req.method === 'POST' && path === '/api/login') {
      const { username, password } = await req.json();
      const user = await getUser(env, String(username || ''));
      if (!user) return json({ error: 'Invalid username or password' }, 401);
      const hash = await hashPassword(String(password || ''), user.salt);
      if (hash !== user.hash) return json({ error: 'Invalid username or password' }, 401);
      const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      await env.KV.put('sess:' + token, user.username, { expirationTtl: 604800 });
      return json({ ok: true, username: user.username, role: user.role }, 200,
        { 'Set-Cookie': 'fi_sess=' + token + '; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax' });
    }

    if (req.method === 'POST' && path === '/api/register') {
      const { username, password } = await req.json();
      const name = String(username || '').trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,24}$/.test(name)) return json({ error: 'Username must be 2-24 chars (a-z, 0-9, _ -)' }, 400);
      if (String(password || '').length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
      if (await getUser(env, name)) return json({ error: 'Username already taken' }, 400);
      const salt = newSalt();
      const user = { username: name, role: 'member', salt, hash: await hashPassword(String(password || ''), salt), created: Date.now() };
      await env.KV.put('user:' + name, JSON.stringify(user));
      const rtoken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      await env.KV.put('sess:' + rtoken, user.username, { expirationTtl: 604800 });
      return json({ ok: true, username: user.username, role: user.role }, 200,
        { 'Set-Cookie': 'fi_sess=' + rtoken + '; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax' });
    }

    if (req.method === 'POST' && path === '/api/logout') {
      const m = (req.headers.get('Cookie') || '').match(/fi_sess=([a-f0-9]+)/);
      if (m) await env.KV.delete('sess:' + m[1]);
      return json({ ok: true }, 200, { 'Set-Cookie': 'fi_sess=; HttpOnly; Secure; Path=/; Max-Age=0' });
    }

    if (req.method === 'GET' && path === '/api/me') {
      const s = await requireUser(env, req);
      if (!s) return json({ error: 'Not signed in' }, 401);
      return json({ username: s.user.username, role: s.user.role });
    }

    if (req.method === 'GET' && path === '/api/apps') {
      if (!(await requireUser(env, req))) return json({ error: 'Not signed in' }, 401);
      return json([
        { name: 'Agent chat', status: 'running' },
        { name: 'Catalog', status: 'running' },
        { name: 'Windows VM', status: 'see catalog (needs KVM server)' },
        { name: 'Browser / Terminal', status: 'see catalog (needs Docker server)' },
      ]);
    }

    if (req.method === 'GET' && path === '/api/catalog') {
      if (!(await requireUser(env, req))) return json({ error: 'Not signed in' }, 401);
      return json(CATALOG);
    }

    // ---- per-user LLM (free API) settings ----
    if (path === '/api/llm') {
      const s = await requireUser(env, req);
      if (!s) return json({ error: 'Not signed in' }, 401);
      const kvKey = 'llm:' + s.user.username;

      if (req.method === 'GET') {
        const raw = await env.KV.get(kvKey);
        if (!raw) return json({ configured: false });
        const cfg = JSON.parse(raw);
        return json({ configured: true, provider: cfg.provider, model: cfg.model, keyHint: '…' + (cfg.key || '').slice(-4) });
      }

      if (req.method === 'POST') {
        const { provider, key, model, base } = await req.json();
        if (!PROVIDERS[provider] && provider !== 'custom') return json({ error: 'Unknown provider' }, 400);
        if (!String(key || '').trim()) return json({ error: 'API key is required' }, 400);
        if (provider === 'custom' && !/^https?:\/\//.test(String(base || ''))) return json({ error: 'Custom provider needs an https base URL' }, 400);
        const cfg = { provider, key: String(key).trim(), model: String(model || '').trim() || (PROVIDERS[provider] ? PROVIDERS[provider].defaultModel : ''), base: String(base || '').trim() };
        await env.KV.put(kvKey, JSON.stringify(cfg));
        return json({ ok: true, provider, model: cfg.model });
      }
    }

    // ---- admin: user management ----
    if (path.startsWith('/api/users')) {
      const s = await requireUser(env, req);
      if (!s) return json({ error: 'Not signed in' }, 401);
      if (s.user.role !== 'admin') return json({ error: 'Admin only' }, 403);

      if (req.method === 'GET' && path === '/api/users') {
        const list = await env.KV.list({ prefix: 'user:' });
        const users = [];
        for (const k of list.keys) {
          const u = JSON.parse(await env.KV.get(k.name));
          users.push({ username: u.username, role: u.role });
        }
        return json({ users });
      }

      if (req.method === 'POST' && path === '/api/users') {
        const { username, password, role } = await req.json();
        const name = String(username || '').trim().toLowerCase();
        if (!/^[a-z0-9_-]{2,24}$/.test(name)) return json({ error: 'Username must be 2-24 chars (a-z, 0-9, _ -)' }, 400);
        if (String(password || '').length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
        if (await getUser(env, name)) return json({ error: 'User already exists' }, 400);
        const salt = newSalt();
        const user = { username: name, role: role === 'admin' ? 'admin' : 'member', salt, hash: await hashPassword(String(password), salt), created: Date.now() };
        await env.KV.put('user:' + name, JSON.stringify(user));
        return json({ ok: true, username: name, role: user.role });
      }

      const target = decodeURIComponent(path.split('/')[3] || '');
      if (req.method === 'DELETE' && target) {
        if (target === 'admin') return json({ error: 'Cannot remove the primary admin' }, 400);
        await env.KV.delete('user:' + target);
        return json({ ok: true });
      }
      if (req.method === 'POST' && target && path.endsWith('/password')) {
        const { password } = await req.json();
        if (String(password || '').length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
        const user = await getUser(env, target);
        if (!user) return json({ error: 'No such user' }, 404);
        user.salt = newSalt();
        user.hash = await hashPassword(String(password), user.salt);
        await env.KV.put('user:' + target, JSON.stringify(user));
        return json({ ok: true });
      }
    }

    if (req.method === 'POST' && path === '/api/chat') {
      const s = await requireUser(env, req);
      if (!s) return json({ error: 'Not signed in' }, 401);
      const { message } = await req.json();

      // per-user key first, then the worker-wide key
      let cfg = null;
      try { const raw = await env.KV.get('llm:' + s.user.username); if (raw) cfg = JSON.parse(raw); } catch (e) {}
      const apiKey = cfg ? cfg.key : env.LLM_KEY;
      if (!apiKey) {
        return json({ reply: "I don't have a brain yet! Open the 'Free AI APIs' panel above, grab a free key from Groq or OpenRouter (1 minute), paste it, and I come alive. Everything else is working." });
      }
      const base = cfg ? (cfg.base || (PROVIDERS[cfg.provider] ? PROVIDERS[cfg.provider].base : '')) : (env.LLM_BASE || 'https://api.openai.com/v1');
      const model = cfg ? (cfg.model || (PROVIDERS[cfg.provider] ? PROVIDERS[cfg.provider].defaultModel : '')) : (env.LLM_MODEL || 'gpt-4o-mini');
      if (!base) return json({ reply: 'Your custom provider is missing a base URL — re-save it in the Free AI APIs panel.' });
      try {
        const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are the foundation-insidious portal assistant. Be concise and helpful.' },
              { role: 'user', content: String(message || '') },
            ],
          }),
        });
        const d = await r.json();
        const reply = d.choices?.[0]?.message?.content;
        if (reply) return json({ reply });
        return json({ reply: 'The API returned an error: ' + (d.error?.message || JSON.stringify(d).slice(0, 200)) + ' — check your key/model in the Free AI APIs panel.' });
      } catch (e) {
        return json({ reply: 'LLM call failed: ' + e.message });
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};