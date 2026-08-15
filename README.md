# HUD Floating Bar

DSH 悬浮 HUD 聊天条：始终置顶的悬浮面板，内含实时会话转录（Markdown 渲染、流式输出）、工作区/会话/模型/推理强度切换，以及画中画（PiP）外置模式——在 Chrome/Edge 下可弹出为 OS 级置顶窗口，盖在其他应用之上。

Official bundle plugin for [DeepSeek Harness](https://github.com/NousResearch/deepseek-harness).

## Features

- **Floating HUD bar** — draggable, resizable, always-on-top overlay inside the web UI
- **Live transcript** — realtime conversation with markdown rendering and streaming cursor; tool calls shown compactly
- **Switchers** — workspace / session / model (grouped by provider) / reasoning effort
- **In-HUD approvals** — pending permission requests render as cards with 允许一次 / 拒绝 buttons (optional: requires bundle-first ordering, see below)
- **Picture-in-Picture detach** — Chrome/Edge 116+: pop the HUD into an OS-level always-on-top PiP window; works across other apps
- **Pin / follow** — pin the HUD to one session or follow the active one
- Keyboard: `Enter` send, `Shift+Enter` newline, `Esc` close (in-page)

## Install

Requires a DSH web profile (0.1.0-rc.6+).

From a local checkout (bundle dir contains the built artifacts):

```sh
dsh plugin --profile web add "/path/to/hud-floating-bar"
```

Or from git (artifacts checked in, one-line install):

```sh
dsh plugin --profile web add "github:owner/hud-floating-bar#main"
```

Then **restart the web app**. The HUD bar appears at the top-left of the page; the sidebar footer also gets a toggle button.

### Optional: enable in-HUD permission approvals

By default permission requests keep going to the main conversation (the
web-UI approval card). To let the HUD answer them instead, move the bundle
**before** `@deepseek-ai/dsh-web-app` in the profile's bundle order — the
HUD's `approval/request` answerer must register before the web UI's:

```sh
# edit ~/.dsh/profiles/web/package.json, reorder dsh.profile.bundles:
#   "bundles": ["hud-floating-bar", "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]
# then restart the web app
```

With this ordering:

- HUD open → approvals appear in the HUD (允许一次 / 拒绝); the main UI does not show a card
- HUD closed → approvals fall back to the main UI (unchanged behavior)
- Plugin unload cancels all pending approvals (agents never hang)

## Usage

- Type a message, press `Enter` to send — the reply streams into the bar (and the main conversation, same session)
- Top row: status dot, session title, `外置` (PiP detach), pin/follow, close
- Second row: workspace / session / model / reasoning effort selectors
- Drag the header to move, drag the bottom-right corner to resize
- `Esc` or `Ctrl+Shift+H` closes the in-page bar

## Package layout

```
hud-floating-bar/
├── package.json         # dsh.bundle + dsh.client manifest
├── cordis.patch.yml     # bundle layer: inserts the Node half
├── index.mjs            # Node half: /hud-api/* JSON endpoints (transcript, send, model)
└── client/index.js      # browser bundle: HUD UI (__ModuleLoader__.load)
```

The Node half serves six same-origin endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /hud-api/surface?sessionId=` | Incremental transcript rows + agent status + pending approvals |
| `POST /hud-api/send` | Send a user message (official agent inbox) |
| `GET /hud-api/model?sessionId=` | Model catalog + current selection |
| `POST /hud-api/set-model` | Switch model / reasoning effort (next turn) |
| `POST /hud-api/set-open` | Sync HUD open/closed state (approval routing) |
| `POST /hud-api/approve` | Answer a pending approval (`allowed-once` / `rejected`) |

## Notes

- PiP detach requires Chrome/Edge 116+ (`documentPictureInPicture`); Safari/Firefox fall back to the in-page bar.
- Model switches take effect on the next agent step and are also saved as the default selection.

## License

MIT
