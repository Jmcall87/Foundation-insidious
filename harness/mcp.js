// MCP (Model Context Protocol) connector manager.
// Add any MCP server to mcp-servers.json and its tools appear in chat automatically.
const fs = require('fs');
const path = require('path');
const CFG = path.join(__dirname, '..', '..', 'mcp-servers.json');

let servers = {}; // name -> { url, headers, session }
function load() {
  try { servers = JSON.parse(fs.readFileSync(CFG, 'utf8')); }
  catch { servers = {}; }
  for (const name of Object.keys(servers)) servers[name].session = null;
}
load();

async function rpc(name, method, params) {
  const s = servers[name];
  if (!s) throw new Error(`unknown MCP server: ${name}`);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(s.headers || {}) };
  if (s.session) headers['Mcp-Session-Id'] = s.session;
  const res = await fetch(s.url, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now() % 1e6, method, params })
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) s.session = sid;
  const text = await res.text();
  let data;
  try { // streamable HTTP may wrap as SSE
    data = text.startsWith('event:') || text.includes('data:')
      ? JSON.parse(text.split('\n').filter(l => l.startsWith('data:')).pop().slice(5))
      : JSON.parse(text);
  } catch { throw new Error(`MCP ${name} bad response: ${text.slice(0, 200)}`); }
  if (data.error) throw new Error(`MCP ${name}: ${data.error.message}`);
  return data.result;
}

async function init(name) {
  await rpc(name, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'selfhost-portal', version: '1.0.0' }
  });
  await rpc(name, 'notifications/initialized', {}).catch(() => {});
}

async function listTools() {
  const out = [];
  for (const name of Object.keys(servers)) {
    try {
      if (!servers[name].session) await init(name);
      const r = await rpc(name, 'tools/list', {});
      for (const t of r.tools || [])
        out.push({ server: name, name: t.name, description: t.description || '', inputSchema: t.inputSchema });
    } catch (e) { out.push({ server: name, name: '__error', description: e.message }); }
  }
  return out;
}

async function callTool(server, tool, args) {
  if (!servers[server]?.session) await init(server);
  const r = await rpc(server, 'tools/call', { name: tool, arguments: args || {} });
  return r.content?.map(c => c.text || JSON.stringify(c)).join('\n') || JSON.stringify(r);
}

module.exports = { listTools, callTool, reload: load };
