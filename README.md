[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Jmcall87/Foundation-insidious)

**One-click deploy:** click the button, sign in with GitHub, set your `ADMIN_PASS` password, click *Apply*. Live in ~2 minutes.

--- 

---
title: Foundation Insidious
emoji: 🚀
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Foundation Insidious

Self-hosting portal: chat + agent harness + one-click app dashboard.

**Hosted mode (this Space):** chat, LLM agent, MCP tools, and site publishing work fully.
The Windows VM / browser / terminal deploys need Docker, which shared hosts don't expose —
run the same code on your own server with `install.sh` for those.

## Setup (Space settings → Secrets)
- `ADMIN_PASS` — your admin password (username defaults to `admin`)
- `SESSION_SECRET` — random string
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` — any OpenAI-compatible provider
