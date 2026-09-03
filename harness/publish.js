// Publish-to-your-own-sites connectors. Destinations live in
// path.join(process.env.DATA_DIR || './data', 'publish-destinations.json') (mounted volume, gitignored).
// Supported types: wordpress, ghost, github_page, webhook.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEST_FILE = process.env.PUBLISH_DEST_FILE || path.join(process.env.DATA_DIR || './data', 'publish-destinations.json');

function loadDestinations() {
  try { return JSON.parse(fs.readFileSync(DEST_FILE, 'utf8')); }
  catch { return {}; }
}

function getDestination(name) {
  const all = loadDestinations();
  const d = all[name];
  if (!d) throw new Error(`unknown destination '${name}'. Configured: ${Object.keys(all).join(', ') || 'none'}`);
  return d;
}

function listDestinations() {
  const all = loadDestinations();
  return Object.entries(all).map(([name, d]) => ({ name, type: d.type, site: d.site || d.repo || d.url }));
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${String(text).slice(0, 300)}`);
  return body;
}

// ---- WordPress (REST API + Application Password) ----
async function publishWordpress(d, { title, content, status }) {
  const auth = Buffer.from(`${d.user}:${d.appPassword}`).toString('base64');
  const out = await fetchJson(`${d.site.replace(/\/$/, '')}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename=".payload.json"'
    },
    body: JSON.stringify({ title, content, status: status || 'draft' })
  });
  return { ok: true, url: out.link, id: out.id, state: out.status };
}

// ---- Ghost (Admin API, JWT from Admin key "id:secret") ----
function ghostToken(key) {
  const [kid, secret] = String(key).split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000) - 5, exp: Math.floor(Date.now() / 1000) + 300, aud: '/v3/admin/' })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
async function publishGhost(d, { title, content, status }) {
  const out = await fetchJson(`${d.site.replace(/\/$/, '')}/ghost/api/admin/posts/`, {
    method: 'POST',
    headers: { 'Authorization': `Ghost ${ghostToken(d.adminKey)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts: [{ title, html: content, status: status || 'draft' }] })
  });
  return { ok: true, url: d.site.replace(/\/$/, '') + '/' + out.posts[0].slug, id: out.posts[0].id, state: out.posts[0].status };
}

// ---- GitHub-hosted static site (commit a markdown file, site rebuilds) ----
async function publishGithubPage(d, { title, content, slug }) {
  const [repoBranch, file] = [d.branch || 'main', d.pathTemplate || 'content/posts/{slug}.md'];
  const date = new Date().toISOString().slice(0, 10);
  const finalSlug = (slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 80);
  const filePath = file.replace('{slug}', finalSlug).replace('{date}', date);
  const fm = `---\ntitle: "${String(title).replace(/"/g, '\\"')}"\ndate: ${date}\n---\n\n`;
  const api = `https://api.github.com/repos/${d.repo}/contents/${filePath}`;
  let sha;
  try {
    const existing = await fetchJson(`${api}?ref=${repoBranch}`, { headers: { 'Authorization': `Bearer ${d.token}`, 'User-Agent': 'selfhost-portal' } });
    sha = existing.sha;
  } catch {}
  const out = await fetchJson(api, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${d.token}`, 'User-Agent': 'selfhost-portal', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `post: ${title}`, content: Buffer.from(fm + content).toString('base64'), branch: repoBranch, ...(sha ? { sha } : {}) })
  });
  const url = d.baseUrl ? `${d.baseUrl.replace(/\/$/, '')}/${finalSlug}/` : (out.content && out.content.html_url);
  return { ok: true, url, commit: out.commit.sha.slice(0, 7) };
}

// ---- Webhook (any custom site: POST JSON, site does the rest) ----
async function publishWebhook(d, payload) {
  const headers = { 'Content-Type': 'application/json', ...(d.headers || {}) };
  if (d.bearerToken) headers['Authorization'] = `Bearer ${d.bearerToken}`;
  const out = await fetchJson(d.url, { method: 'POST', headers, body: JSON.stringify(payload) });
  return { ok: true, response: typeof out === 'string' ? out.slice(0, 300) : out };
}

const CONNECTORS = { wordpress: publishWordpress, ghost: publishGhost, github_page: publishGithubPage, webhook: publishWebhook };

async function publishPost(destination, { title, content, status, slug }) {
  if (!title || !content) throw new Error('title and content are required');
  const d = getDestination(destination);
  const fn = CONNECTORS[d.type];
  if (!fn) throw new Error(`destination '${destination}' has unknown type '${d.type}' (supported: ${Object.keys(CONNECTORS).join(', ')})`);
  const result = await fn(d, { title, content, status, slug });
  return { destination, type: d.type, ...result };
}

// Preview destinations without publishing (safe for the agent to call first)
async function publishPreview(destination) {
  const d = getDestination(destination);
  return { name: destination, type: d.type, site: d.site || d.repo || d.url, notes: 'preview only — nothing published' };
}

module.exports = { publishPost, publishPreview, listDestinations, loadDestinations };
