// Agent orchestrator: LLM + tools (docker control + MCP) in a tool-calling loop.
const { chat, MODEL } = require('./llm');
const mcp = require('./mcp');
const { dockerAction } = require('./tools');
const publish = require('./publish');

const SYSTEM = `You are the assistant inside a self-hosted portal. You control a Docker host
running apps: windows (Windows VM, port 8006), reactos (port 8007), neko (browser, port 8081),
ttyd (terminal, port 7681).
You can: deploy/stop/restart apps via the docker tool, and use any MCP connector tools
(email, calendar, drive, github, web scraping, databases, and hundreds more) to do real work for the user.
You can also publish posts directly to the user's own sites (WordPress, Ghost, static sites, custom webhooks)
with the publish tools. Use publish_list_destinations first to see what is configured; use publish_post
with status 'draft' unless the user explicitly says publish live; NEVER publish to sites not in the destination list.
Be concise. When a task needs a tool, call it. Report results plainly.`;

async function listAllTools() {
  const mcpTools = await mcp.listTools();
  return mcpTools
    .filter(t => t.name !== '__error')
    .map(t => ({
      type: 'function',
      function: {
        name: `mcp_${t.server}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
        description: `[MCP:${t.server}] ${t.description}`.slice(0, 500),
        parameters: t.inputSchema || { type: 'object', properties: {} }
      },
      _impl: { server: t.server, tool: t.name }
    }))
    .concat([
      {
        type: 'function',
        function: {
          name: 'docker_control',
          description: 'Manage portal apps: deploy, stop, restart, or status. Apps: windows, reactos, neko, ttyd.',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['deploy', 'stop', 'restart', 'status'] },
              app: { type: 'string', enum: ['windows', 'reactos', 'neko', 'ttyd'] }
            },
            required: ['action']
          }
        },
        _impl: { kind: 'docker' }
      },
      {
        type: 'function',
        function: {
          name: 'publish_list_destinations',
          description: 'List the configured publish destinations (the user\'s own sites). Always call this before publishing.',
          parameters: { type: 'object', properties: {} }
        },
        _impl: { kind: 'publish', fn: 'listDestinations' }
      },
      {
        type: 'function',
        function: {
          name: 'publish_preview',
          description: 'Preview one publish destination without publishing anything.',
          parameters: {
            type: 'object',
            properties: { destination: { type: 'string' } },
            required: ['destination']
          }
        },
        _impl: { kind: 'publish', fn: 'publishPreview' }
      },
      {
        type: 'function',
        function: {
          name: 'publish_post',
          description: 'Publish a post to one of the user\'s own sites. Supports: wordpress, ghost, github_page (static site via repo commit), webhook (custom site).',
          parameters: {
            type: 'object',
            properties: {
              destination: { type: 'string', description: 'destination name from publish_list_destinations' },
              title: { type: 'string' },
              content: { type: 'string', description: 'HTML or markdown body' },
              status: { type: 'string', enum: ['draft', 'publish'], description: "default 'draft'" },
              slug: { type: 'string' }
            },
            required: ['destination', 'title', 'content']
          }
        },
        _impl: { kind: 'publish', fn: 'publishPost' }
      }
    ]);
}

// history: [{role, content}] — mutated with assistant/tool turns
async function run(history, onEvent) {
  const emit = onEvent || (() => {});
  const tools = await listAllTools();
  const toolMap = Object.fromEntries(tools.map(t => [t.function.name, t]));
  const messages = [{ role: 'system', content: SYSTEM }, ...history];

  for (let hop = 0; hop < 8; hop++) {
    const msg = await chat(messages, tools);
    messages.push(msg);
    const calls = msg.tool_calls || [];
    if (!calls.length) return { reply: msg.content || '', hops: hop };

    for (const call of calls) {
      const name = call.function.name;
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
      emit({ type: 'tool', name, args });
      let result;
      try {
        const impl = toolMap[name]?._impl;
        if (!impl) result = `unknown tool: ${name}`;
        else if (impl.kind === 'docker')
          result = JSON.stringify(await dockerAction(args.action, args.app));
        else if (impl.kind === 'publish')
          result = JSON.stringify(await publish[impl.fn](...(impl.fn === 'publishPost' ? [args.destination, args] : [args.destination].filter(Boolean))));
        else
          result = await mcp.callTool(impl.server, impl.tool, args);
      } catch (e) { result = `Error: ${e.message}`; }
      emit({ type: 'tool_result', name, ok: !result.startsWith('Error') });
      messages.push({ role: 'tool', tool_call_id: call.id, content: String(result).slice(0, 8000) });
    }
  }
  return { reply: '(stopped after 8 tool hops)', hops: 8 };
}

module.exports = { run, listAllTools, MODEL };
