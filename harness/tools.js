// Docker control used by both the API routes and the agent.
const APPS = {
  windows: { image: 'dockurr/windows', name: 'windows-vm', port: 8006, env: { VERSION: '11' }, kvm: true },
  reactos: { image: 'dockurr/reactos', name: 'reactos', port: 8007, env: {}, kvm: false },
  neko:    { image: 'm1k1o/neko:firefox', name: 'neko', port: 8081, env: { NEKO_PASSWORD: 'neko' }, kvm: false },
  ttyd:    { image: 'tsl0922/ttyd', name: 'ttyd', port: 7681, cmd: ['-W', 'bash'], kvm: false }
};

let docker = null;
function getDocker() {
  if (!docker) {
    const sock = '/var/run/docker.sock';
    if (!require('fs').existsSync(sock))
      throw new Error('Docker is not available on this host (hosted mode) - VM/browser/terminal apps need a self-hosted server with Docker. Chat, agent, LLM and publishing still work here.');
    docker = new (require('dockerode'))({ socketPath: sock });
  }
  return docker;
}

async function dockerAction(action, app) {
  if (action === 'status') {
    let states = {};
    for (const key of Object.keys(APPS)) states[key] = 'unavailable';
    try {
      const d = getDocker();
      const containers = await d.listContainers({ all: true });
      for (const [key, cfg] of Object.entries(APPS))
        states[key] = containers.some(c => c.Names.includes('/' + cfg.name))
          ? (containers.find(c => c.Names.includes('/' + cfg.name)).State)
          : 'absent';
    } catch (e) { states._note = e.message; }
    return { apps: states };
  }
  const cfg = APPS[app];
  if (!cfg) throw new Error(`unknown app: ${app}`);
  const d = getDocker();
  const existing = (await d.listContainers({ all: true })).find(c => c.Names.includes('/' + cfg.name));

  if (action === 'stop') {
    if (!existing) return { ok: true, note: 'not running' };
    const c = d.getContainer(existing.Id);
    await c.stop().catch(() => {});
    await c.remove().catch(() => {});
    return { ok: true, action: 'stopped', app };
  }
  if (action === 'deploy' || action === 'restart') {
    if (existing) { const c = d.getContainer(existing.Id); await c.stop().catch(() => {}); await c.remove().catch(() => {}); }
    await d.pull(cfg.image);
    const portMap = { [`${cfg.port}/tcp`]: [{ HostPort: String(cfg.port) }] };
    const c = await d.createContainer({
      Image: cfg.image,
      name: cfg.name,
      Env: Object.entries(cfg.env).map(([k, v]) => `${k}=${v}`),
      Cmd: cfg.cmd,
      HostConfig: {
        PortBindings: portMap,
        Binds: ['/data/selfhost-portal/data:/data'],
        ExtraHosts: ['host.docker.internal:host-gateway'],
        ...(cfg.kvm ? { Devices: [{ PathOnHost: '/dev/kvm', PathInContainer: '/dev/kvm', CgroupPermissions: 'rwm' }] } : {})
      }
    });
    await c.start();
    return { ok: true, action: 'deployed', app, port: cfg.port, url: `http://localhost:${cfg.port}` };
  }
  throw new Error(`unknown action: ${action}`);
}

module.exports = { dockerAction, APPS };
