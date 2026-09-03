// foundation-insidious — Cloudflare Workers edition (single file, zero dependencies)
// REQUIRED: KV namespace bound as "KV"
// SECRET: ADMIN_PASS (initial admin password, set before first visit)

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
<p class=sub>A self-hosted portal with an AI agent in chat, multi-user accounts, and publishing to your own sites — running free and always-on.</p>
<a class=btn href=/app>Enter the portal →</a></div>
<div class=grid>
<div class=card><h3>💬 Agent chat</h3><p>Talk to the built-in AI assistant right from the dashboard.</p></div>
<div class=card><h3>👥 Multi-user</h3><p>Admin + member accounts, hashed passwords, real sessions.</p></div>
<div class=card><h3>📤 Publish</h3><p>Post content to your own sites from the chat.</p></div>
<div class=card><h3>📦 Self-host GitHub projects</h3><p>Paste any GitHub repo — static sites get hosted live on your site, instantly.</p></div>
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
#signup{display:none;max-width:360px;margin:60px auto;background:#121722;border:1px solid #1c2230;border-radius:12px;padding:28px}
#signup h2{margin-bottom:4px}
#signup .sub{color:#9aa3b5;font-size:13px;margin-bottom:10px}
#signup label{display:block;font-size:11px;color:#9aa3b5;margin:12px 0 3px;text-transform:uppercase;letter-spacing:.05em}
#signup input{width:100%;padding:10px;margin:0;background:#0b0e14;border:1px solid #2a3245;border-radius:8px;color:#e8eaf0}
#signup button.cta{width:100%;padding:11px;margin-top:16px;background:#6c8cff;border:none;border-radius:8px;font-weight:700;color:#0b0e14}
.pwrap{position:relative}.pwrap .eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#9aa3b5;font-size:12px;padding:4px}
.hint{font-size:11px;color:#5b6478;margin-top:3px}
#meter{height:5px;background:#0b0e14;border-radius:3px;margin-top:6px;overflow:hidden}
#meter i{display:block;height:100%;width:0;background:#ff7b7b;transition:width .2s,background .2s}
#mlabel{font-size:11px;color:#9aa3b5;min-height:14px;margin:3px 0 4px}
.swap{margin-top:14px;font-size:13px;color:#9aa3b5;text-align:center}
.swap a{color:#6c8cff;cursor:pointer;text-decoration:underline}
#dash{display:none;max-width:900px;margin:24px auto;padding:0 16px}
.msgs{background:#121722;border:1px solid #1c2230;border-radius:12px;padding:16px;height:420px;overflow-y:auto;margin-bottom:10px}
.m{margin:8px 0;padding:10px 14px;border-radius:10px;max-width:85%}.u{background:#6c8cff;color:#0b0e14;margin-left:auto}.a{background:#1c2230}
.row{display:flex;gap:8px}input#c{flex:1;padding:12px;background:#121722;border:1px solid #2a3245;border-radius:10px;color:#e8eaf0}
.row button{padding:12px 22px;background:#6c8cff;border:none;border-radius:10px;font-weight:700;color:#0b0e14}
#apps{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}.chip{background:#121722;border:1px solid #1c2230;border-radius:20px;padding:7px 14px;font-size:13px;color:#9aa3b5}
.err{color:#ff7b7b;font-size:13px;min-height:16px;margin-top:6px}</style></head><body>
<header><div class=logo>foundation<span>-insidious</span></div><button id=out style="display:none;background:none;border:1px solid #2a3245;color:#9aa3b5;border-radius:8px;padding:7px 14px">Log out</button></header>
<div id=login><h2 style=margin-bottom:14px>Sign in</h2>
<input id=u placeholder="Username"><input id=p type=password placeholder="Password">
<button onclick=doLogin()>Sign in</button><div class=swap style=margin-top:10px>New here? <a onclick=showSignup()>Create an account</a></div><div class=err id=lerr></div></div>
<div id=signup><h2>Create your account</h2>
<p class=sub>Free forever — full member access to the agent chat, GitHub self-hosting and the app catalog.</p>
<label>Username</label><input id=nu placeholder="e.g. joshua" maxlength=24 autocomplete=username>
<div class=hint>2&ndash;24 characters &mdash; letters, numbers, dash or underscore.</div>
<label>Password</label><div class=pwrap><input id=np type=password placeholder="At least 6 characters" oninput=pwStrength() autocomplete=new-password><button type=button class=eye onclick=pwEye()>Show</button></div>
<div id=meter><i></i></div><div id=mlabel></div>
<label>Confirm password</label><input id=nc type=password placeholder="Type it again" autocomplete=new-password>
<button class=cta onclick=doSignup()>Create account</button>
<div class=err id=serr></div>
<div class=swap>Already have an account? <a onclick=showLogin()>Sign in</a></div>
</div>
<div id=dash><div id=apps></div>
<div style="background:#121722;border:1px solid #1c2230;border-radius:12px;padding:16px;margin:10px 0">
<b style="font-size:14px">📦 Self-host a GitHub project</b>
<div class=row style=margin-top:8px><input id=gh placeholder="github.com/owner/repo — paste and Import" onkeydown="if(event.key=='Enter')doImport()"><button onclick=doImport()>Import</button></div>
<div id=sitelist style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>
<div class=err id=gherr></div>
</div>
<div class=msgs id=msgs></div>
<div class=row><input id=c placeholder="Ask the agent anything…" onkeydown="if(event.key=='Enter')send()">
<button onclick=send()>Send</button></div></div>
<script>
let me=null;
async function j(url,opt){const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));return{r,d}}
async function boot(){const{r,d}=await j('/api/me');if(r.ok){me=d;entered()}else showLogin();loadApps()}
function showLogin(){signup.style.display='none';login.style.display='block';dash.style.display='none';out.style.display='none'}
function entered(){login.style.display='none';dash.style.display='block';out.style.display='block';
add('a','Welcome back, '+me.username+'. Ask me anything.');loadSites()}
async function doLogin(){lerr.textContent='';const{r,d}=await j('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.value,password:p.value})});
if(r.ok){me=d;entered()}else lerr.textContent=d.error||'Login failed'}
function showSignup(){login.style.display='none';signup.style.display='block';dash.style.display='none';out.style.display='none';serr.textContent=''}
function pwEye(){const e=np;const s=e.type==='password';e.type=s?'text':'password';document.querySelector('.eye').textContent=s?'Hide':'Show'}
function pwStrength(){const v=np.value;let s=0;if(v.length>=6)s++;if(v.length>=10)s++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))s++;if(/\d/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
const bar=meter.firstElementChild;bar.style.width=(s*20)+'%';bar.style.background=s<2?'#ff7b7b':(s<4?'#f0c674':'#7bd88f');
mlabel.textContent=v?'Strength: '+['Very weak','Weak','Fair','Good','Strong','Excellent'][s]:''}
async function doSignup(){serr.textContent='';const un=nu.value.trim(),pw=np.value;
if(un.length<2)return serr.textContent='Username must be at least 2 characters';
if(!/^[a-zA-Z0-9_-]+$/.test(un))return serr.textContent='Username: only letters, numbers, dash or underscore';
if(pw.length<6)return serr.textContent='Password must be at least 6 characters';
if(pw!==nc.value)return serr.textContent='Passwords do not match';
const{r,d}=await j('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un,password:pw})});
if(r.ok){me=d;signup.style.display='none';entered()}else serr.textContent=d.error||'Sign up failed'}
out.onclick=async()=>{await j('/api/logout',{method:'POST'});me=null;showLogin()};
async function loadApps(){const{d}=await j('/api/apps');apps.innerHTML=d.map(a=>'<span class=chip>'+a.name+': '+a.status+'</span>').join('')}
async function loadSites(){const{d}=await j('/api/sites');sitelist.innerHTML=d.map(s=>'<a class=chip href="/sites/'+s.name+'/" target=_blank style="color:#6c8cff;text-decoration:none">📦 '+s.name+'</a>').join('')}
async function doImport(){gherr.textContent='';const repo=gh.value.trim();if(!repo)return;gh.value='';
const{r,d}=await j('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repo})});
if(r.ok){add('a','Imported '+d.repo+(d.kind=='site'?': static site is LIVE at /sites/'+d.name+'/ ('+d.files+' files)':' — this one needs a real server, so I catalogued it.'));loadSites()}
else gherr.textContent=d.error||'Import failed'}
function add(who,text){const e=document.createElement('div');e.className='m '+who;e.textContent=text;msgs.appendChild(e);msgs.scrollTop=msgs.scrollHeight}
async function send(){const t=c.value.trim();if(!t)return;c.value='';add('u',t);
const{r,d}=await j('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t})});
add('a',r.ok?d.reply:(d.error||'Error'))}
boot()
</script></body></html>`;

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
        { name: 'Windows VM', status: 'unavailable (needs own server)' },
        { name: 'Browser', status: 'unavailable (needs own server)' },
        { name: 'Terminal', status: 'unavailable (needs own server)' },
        { name: 'Agent chat', status: 'running' },
      ]);
    }

    // ---- github import & self-hosting ----
    const CT = { html:'text/html; charset=utf-8', css:'text/css', js:'application/javascript', mjs:'application/javascript', json:'application/json', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', svg:'image/svg+xml', ico:'image/x-icon', woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', txt:'text/plain; charset=utf-8', md:'text/plain; charset=utf-8', xml:'application/xml', webp:'image/webp', mp4:'video/mp4', wasm:'application/wasm' };
    const GH = env.GITHUB_TOKEN ? { 'User-Agent':'foundation-insidious', Authorization:'Bearer '+env.GITHUB_TOKEN } : { 'User-Agent':'foundation-insidious' };
    function parseRepo(input) {
      const s = String(input || '').trim();
      let m = s.match(/github\.com[\/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/.*)?$/) || s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
      return m ? { owner: m[1], repo: m[2].replace(/\.git$/, '') } : null;
    }
    async function importRepo(env, user, input) {
      const p = parseRepo(input);
      if (!p) return { err: 'Paste a GitHub repo URL like github.com/owner/repo' };
      const name = p.repo.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);
      const meta = await fetch('https://api.github.com/repos/' + p.owner + '/' + p.repo, { headers: GH }).then(r => r.json()).catch(() => null);
      if (!meta || !meta.full_name) return { err: 'Repo not found (or private). Check the URL.' };
      const branch = meta.default_branch || 'HEAD';
      const tree = await fetch('https://api.github.com/repos/' + p.owner + '/' + p.repo + '/git/trees/' + branch + '?recursive=1', { headers: GH }).then(r => r.json()).catch(() => null);
      if (!tree || !Array.isArray(tree.tree)) return { err: 'Could not read the repo file list.' };
      const files = tree.tree.filter(t => t.type === 'blob' && t.size <= 1000000 && !/(^|\/)(node_modules|\.git|vendor|dist)(\/|$)/.test(t.path));
      const idx = files.find(f => f.path === 'index.html') || files.find(f => f.path.endsWith('/index.html'));
      const root = idx ? idx.path.slice(0, idx.path.lastIndexOf('/') + 1) : '';
      const candidates = files.filter(f => f.path.startsWith(root)).slice(0, 25);
      const hasDocker = files.some(f => /(^|\/)dockerfile$/i.test(f.path)) || files.some(f => /docker-compose\.ya?ml$/i.test(f.path));
      const hasPkg = files.some(f => f.path === 'package.json');
      if (!candidates.length) return { err: 'No servable files found in that repo.' };
      const stored = [];
      for (const f of candidates) {
        const raw = await fetch('https://raw.githubusercontent.com/' + p.owner + '/' + p.repo + '/' + branch + '/' + f.path.split('/').map(encodeURIComponent).join('/'), { headers: GH }).catch(() => null);
        if (!raw || !raw.ok) continue;
        const ext = (f.path.split('.').pop() || '').toLowerCase();
        const ct = CT[ext] || 'application/octet-stream';
        const bin = /^(image|font|video|audio)\//.test(ct) || ct === 'application/wasm' || ct === 'application/octet-stream';
        const rec = bin
          ? { b64: btoa(String.fromCharCode(...new Uint8Array(await raw.arrayBuffer()))), ct }
          : { text: await raw.text(), ct };
        await env.KV.put('site:' + name + ':' + f.path.slice(root.length), JSON.stringify(rec));
        stored.push({ path: f.path.slice(root.length), bin });
      }
      if (!stored.length) return { err: 'Downloaded 0 files \u2014 GitHub may be rate-limiting. Try again in a minute.' };
      const needsServer = hasDocker || (hasPkg && !stored.some(f => f.path === 'index.html'));
      const info = { name, repo: meta.full_name, branch, by: user, when: Date.now(), files: stored, kind: idx ? 'site' : 'info', needsServer, desc: (meta.description || '').slice(0, 200) };
      await env.KV.put('site:' + name + ':_meta', JSON.stringify(info));
      return { info };
    }

    if (req.method === 'POST' && path === '/api/import') {
      const s = await requireUser(env, req);
      if (!s) return json({ error: 'Not signed in' }, 401);
      const { repo } = await req.json();
      const r = await importRepo(env, s.user.username, repo);
      if (r.err) return json({ error: r.err }, r.err.toLowerCase().includes('not found') ? 404 : 400);
      const i = r.info;
      if (i.kind === 'site') return json({ ok: true, name: i.name, repo: i.repo, files: i.files.length, kind: 'site', url: '/sites/' + i.name + '/' });
      return json({ ok: true, name: i.name, repo: i.repo, files: i.files.length, kind: 'info', reason: i.needsServer ? 'needs Docker/Node server' : 'no index.html - catalogued with its README' });
    }

    if (req.method === 'GET' && path === '/api/sites') {
      if (!(await requireUser(env, req))) return json({ error: 'Not signed in' }, 401);
      const list = await env.KV.list({ prefix: 'site:' });
      const sites = [];
      for (const k of list.keys) {
        if (!k.name.endsWith(':_meta')) continue;
        const i = JSON.parse(await env.KV.get(k.name));
        sites.push({ name: i.name, repo: i.repo, kind: i.kind, files: i.files.length, when: i.when });
      }
      return json(sites);
    }

    const siteDel = path.match(/^\/api\/sites\/([a-z0-9_-]+)$/);
    if (req.method === 'DELETE' && siteDel) {
      const s = await requireUser(env, req);
      if (!s) return json({ error: 'Not signed in' }, 401);
      const list = await env.KV.list({ prefix: 'site:' + siteDel[1] + ':' });
      for (const k of list.keys) await env.KV.delete(k.name);
      return json({ ok: true });
    }

    if (req.method === 'GET' && path.startsWith('/sites/')) {
      const rest = path.slice('/sites/'.length);
      const slash = rest.indexOf('/');
      const name = slash < 0 ? rest : rest.slice(0, slash);
      let rel = slash < 0 ? '' : decodeURIComponent(rest.slice(slash + 1));
      if (!/^[a-z0-9_-]+$/.test(name) || rel.includes('..')) return json({ error: 'Bad path' }, 400);
      const metaRaw = await env.KV.get('site:' + name + ':_meta');
      if (!metaRaw) return new Response('No such imported site.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      const meta = JSON.parse(metaRaw);
      if (!rel) {
        if (meta.kind === 'site') rel = 'index.html';
        else {
          const readme = meta.files.find(f => /^readme\.(md|txt)$/i.test(f.path));
          const rec = readme ? JSON.parse(await env.KV.get('site:' + name + ':' + readme.path)) : null;
          return html('<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0b0e14;color:#e8eaf0;max-width:760px;margin:40px auto;padding:0 16px"><h1>\U0001F4E6 ' + meta.repo + '</h1><p style="color:#9aa3b5">' + (meta.desc || '') + '</p><p style="background:#1c2230;padding:14px;border-radius:10px">This project needs a real server (' + (meta.needsServer ? 'Docker/Node' : 'no index.html found') + '), so it can\u0027t execute on this free edge host. Its files are downloaded and catalogued here, ready for a VPS. Source: <a style="color:#6c8cff" href="https://github.com/' + meta.repo + '">github.com/' + meta.repo + '</a></p><pre style="white-space:pre-wrap;color:#9aa3b5;font-size:13px">' + (rec ? rec.text.slice(0, 6000).replace(/</g, '&lt;') : 'No README found.') + '</pre>');
        }
      }
      const v = await env.KV.get('site:' + name + ':' + rel);
      if (!v) {
        const asIndex = await env.KV.get('site:' + name + ':' + rel.replace(/\/?$/, '') + '/index.html');
        if (!asIndex) return new Response('404 \u2014 not in this imported site.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
        const recA = JSON.parse(asIndex);
        return new Response(recA.b64 ? Uint8Array.from(atob(recA.b64), c => c.charCodeAt(0)) : recA.text, { headers: { 'Content-Type': recA.ct, 'Cache-Control': 'no-store' } });
      }
      const rec = JSON.parse(v);
      return new Response(rec.b64 ? Uint8Array.from(atob(rec.b64), c => c.charCodeAt(0)) : rec.text, { headers: { 'Content-Type': rec.ct, 'Cache-Control': 'no-store' } });
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
      const ghHit = String(message || '').match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
      if (ghHit) {
        const r = await importRepo(env, s.user.username, ghHit[0]);
        if (r.err) return json({ reply: 'I tried to import ' + ghHit[0] + ' but: ' + r.err });
        const i = r.info;
        return json({ reply: i.kind === 'site'
          ? 'Imported ' + i.repo + ' — its static site is now LIVE on your portal at /sites/' + i.name + '/ (' + i.files.length + ' files served).'
          : 'Downloaded and catalogued ' + i.repo + ' (' + i.files.length + ' files). Honest note: this one ' + (i.needsServer ? 'needs a real server (Docker/Node), which this free edge host cannot run — it is staged and ready for a VPS.' : 'has no index.html, so I published its README at /sites/' + i.name + '/ instead.') });
      }
      if (!env.LLM_KEY) return json({ reply: "Agent brain not configured yet. Add a secret named LLM_KEY (an OpenAI-compatible API key) in this Worker's settings, and I'll come alive. Everything else is working!" });
      try {
        const r = await fetch((env.LLM_BASE || 'https://api.openai.com/v1') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.LLM_KEY },
          body: JSON.stringify({
            model: env.LLM_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are the foundation-insidious portal assistant. Be concise and helpful.' },
              { role: 'user', content: String(message || '') },
            ],
          }),
        });
        const d = await r.json();
        return json({ reply: d.choices?.[0]?.message?.content || 'The LLM returned no reply.' });
      } catch (e) {
        return json({ reply: 'LLM call failed: ' + e.message });
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
