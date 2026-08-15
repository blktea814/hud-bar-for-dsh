# HUD 悬浮条（HUD Floating Bar）

DSH 悬浮 HUD 聊天条：始终置顶的悬浮面板，通过画中画（PiP）外置在 Chrome/Edge 下可弹出为 OS 级置顶窗口，方便在其他界面进行工作时随时使用dsh。

[English](README.md)

[DeepSeek Harness](https://github.com/NousResearch/deepseek-harness) 官方 bundle 插件。

## 功能特性

- **悬浮 HUD 条** — 始终置顶、可拖拽、可缩放
- **实时转录** — Markdown 渲染、流式输出光标、工具调用紧凑展示
- **切换器** — 工作区 / 会话 / 模型（按提供方分组）/ 推理强度，输入框上方亦有内联切换
- **审批提示** — 任一会话有待审批的权限请求时显示黄色提示条，提醒回主界面批准
- **画中画外置** — Chrome/Edge 116+ 可弹出为 OS 级置顶窗口。
- **固定与跟随** — 固定到某会话，或跟随当前活跃会话
- 快捷键：`Enter` 发送、`Shift+Enter` 换行、`Esc` 关闭（页内）

![悬浮 HUD 条](screenshots/hud-bar.png)

## 安装

需要 DSH web profile（0.1.0-rc.6 及以上）。

本地检出安装（仓库内含构建产物）：

```sh
dsh plugin --profile web add "/path/to/hud-floating-bar"
```

或从 git 一行安装：

```sh
dsh plugin --profile web add "github:blktea814/hud-bar-for-dsh#main"
```

安装后**重启 web 应用**。HUD 条出现在页面左上角，侧栏底部也会多出一个开关按钮。

## 使用

- 输入消息按 `Enter` 发送，回复流式显示在 HUD 中（与主界面同一会话）
- 输入框上方：模型 / 推理强度切换；运行中主按钮变为"停止生成"
- 顶栏：状态点、会话标题、`外置`（画中画）、固定/跟随、关闭
- 第二行：工作区 / 会话切换
- 拖拽顶栏移动，拖拽右下角调整大小
- `Esc` 或 `Ctrl+Shift+H` 关闭页内悬浮条

## 包结构

```
hud-floating-bar/
├── package.json         # dsh.bundle + dsh.client 清单
├── cordis.patch.yml     # bundle 层，注入 Node 半
├── index.mjs            # Node 半：/hud-api/* JSON 端点
└── client/index.js      # 浏览器端：HUD UI（__ModuleLoader__.load）
```

Node 半提供五个同源端点：

| 端点 | 用途 |
| --- | --- |
| `GET /hud-api/surface?sessionId=` | 增量转录 + agent 状态 + 待审批 |
| `POST /hud-api/send` | 发送用户消息（官方 agent 收件箱） |
| `GET /hud-api/model?sessionId=` | 模型目录 + 当前选择 |
| `POST /hud-api/set-model` | 切换模型 / 推理强度（下一轮生效） |
| `POST /hud-api/stop` | 停止生成 |

## 说明

- 外置功能需要 Chrome/Edge 116+（`documentPictureInPicture`），其他浏览器回退为页内悬浮条
- 模型切换下一轮生效，并保存为默认选择
- 权限审批由主界面官方审批卡片处理，HUD 仅在有待审批时提示

## 许可

MIT
