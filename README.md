# HUD Floating Bar

DSH 悬浮 HUD 聊天条：始终置顶的悬浮面板，画中画（PiP）外置模式——在 Chrome/Edge 下可弹出为 OS 级置顶窗口，覆盖在其他应用之上。

An always-on-top floating HUD chat bar for DeepSeek Harness: live session transcript (markdown rendering, streaming output), workspace / session / model / reasoning-effort switching, and Picture-in-Picture (PiP) detach — pop the HUD into an OS-level always-on-top window (Chrome/Edge), usable over any other app.

Official bundle plugin for [DeepSeek Harness](https://github.com/NousResearch/deepseek-harness).

## Features / 功能特性

- **Floating HUD bar / 悬浮 HUD 条** — draggable, resizable, always-on-top overlay inside the web UI（可拖拽、可缩放、网页内始终置顶悬浮面板）
- **Live transcript / 实时转录** — realtime conversation with markdown rendering and streaming cursor; tool calls shown compactly（Markdown 渲染、流式输出光标、工具调用紧凑展示）
- **Switchers / 切换器** — workspace / session / model (grouped by provider) / reasoning effort, also inline above the composer（工作区/会话/模型/推理强度，输入框上方亦有内联切换）
- **Send / Stop generating / 发送与停止生成** — the primary button turns into 停止生成 while the agent is running, like the main web composer（agent 运行中主按钮变为"停止生成"，与网页版一致）
- **Approval notice / 待审批提示** — a banner appears when any session awaits a permission approval, telling you to approve in the main UI（任一会话有待审批请求时显示黄色提示条，提醒回主界面批准）
- **Picture-in-Picture detach / 画中画外置** — Chrome/Edge 116+: pop the HUD into an OS-level always-on-top PiP window; works across other apps（弹出为 OS 级置顶画中画窗口）
- **Pin / follow / 固定与会话跟随** — pin the HUD to one session or follow the active one（固定到某会话，或跟随当前活跃会话）
- Keyboard: `Enter` send, `Shift+Enter` newline, `Esc` close (in-page)（快捷键：`Enter` 发送、`Shift+Enter` 换行、`Esc` 关闭）

## Install / 安装

Requires a DSH web profile (0.1.0-rc.6+). 需要 DSH web profile（0.1.0-rc.6 及以上）。

From a local checkout (bundle dir contains the built artifacts) / 本地检出安装（仓库内含构建产物）：

```sh
dsh plugin --profile web add "/path/to/hud-floating-bar"
```

Or from git (artifacts checked in, one-line install) / 或从 git 一行安装：

```sh
dsh plugin --profile web add "github:blktea814/hud-floating-bar#main"
```

Then **restart the web app**. The HUD bar appears at the top-left of the page; the sidebar footer also gets a toggle button.
安装后**重启 web 应用**。HUD 条出现在页面左上角，侧栏底部也会多出一个开关按钮。

## Usage / 使用

- Type a message, press `Enter` to send — the reply streams into the bar (and the main conversation, same session)（输入消息按 `Enter` 发送，回复流式显示在 HUD 中，同一会话）
- Above the input: model / reasoning effort selectors; the primary button turns into 停止生成 while the agent runs（输入框上方：模型/推理强度切换；运行中主按钮变为"停止生成"）
- Top row: status dot, session title, `外置` (PiP detach), pin/follow, close（顶栏：状态点、会话标题、外置、固定/跟随、关闭）
- Second row: workspace / session selectors（第二行：工作区/会话切换）
- Drag the header to move, drag the bottom-right corner to resize（拖拽顶栏移动，拖拽右下角调整大小）
- `Esc` or `Ctrl+Shift+H` closes the in-page bar（`Esc` 或 `Ctrl+Shift+H` 关闭页内悬浮条）

## Package layout / 包结构

```
hud-floating-bar/
├── package.json         # dsh.bundle + dsh.client manifest（清单）
├── cordis.patch.yml     # bundle layer: inserts the Node half（bundle 层，注入 Node 半）
├── index.mjs            # Node half: /hud-api/* JSON endpoints（服务端半）
└── client/index.js      # browser bundle: HUD UI (__ModuleLoader__.load)（浏览器端 UI）
```

The Node half serves five same-origin endpoints / Node 半提供五个同源端点：

| Endpoint / 端点 | Purpose / 用途 |
| --- | --- |
| `GET /hud-api/surface?sessionId=` | Incremental transcript rows + agent status + pending approvals（增量转录 + agent 状态 + 待审批） |
| `POST /hud-api/send` | Send a user message (official agent inbox)（发送用户消息） |
| `GET /hud-api/model?sessionId=` | Model catalog + current selection（模型目录 + 当前选择） |
| `POST /hud-api/set-model` | Switch model / reasoning effort (next turn)（切换模型/推理强度） |
| `POST /hud-api/stop` | Stop the running agent（停止生成） |

## Notes / 说明

- PiP detach requires Chrome/Edge 116+ (`documentPictureInPicture`); Safari/Firefox fall back to the in-page bar（画中画需 Chrome/Edge 116+，其他浏览器回退为页内悬浮条）
- Model switches take effect on the next agent step and are also saved as the default selection（模型切换下一轮生效，并保存为默认选择）
- Permission approvals are handled by the official main-UI approval card; the HUD only notifies you when one is pending（权限审批由主界面官方卡片处理，HUD 仅在有待审批时提示）

## License / 许可

MIT
