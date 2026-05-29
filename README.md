# VAD 现场总控 API（4300）

这个仓库是整场室内 DJ / VJ / 多屏演出的总控后端与控制台。它负责保存全局状态、转发实时控制命令、接收 DJ 音频特征、管理 VJ 与 baofa 的屏幕路由。

## 模块关系

固定端口如下：

| 模块 | 仓库 | 端口 | 职责 |
| --- | --- | --- | --- |
| 总控 API | `vad.26.api` | `4300` | 全局状态、Dashboard、WebSocket、屏幕路由 |
| DJ | `mixer-target-123` | `4301` | 播放/混音，向 4300 发布实时音频特征 |
| VJ | `visual-dynamic-effect` | `4302` | 视觉控制台与 `/screen/<screenId>` VJ 输出 |
| 多屏 | `baofa` | `4303` | 原生多屏特效与 `/screen/<screenId>` baofa 输出 |

本地默认通信地址：

- HTTP：`http://<LAN_IP>:4300`
- WebSocket：`ws://<LAN_IP>:4300/ws`

跨机器部署时，屏幕侧应使用同一台控制机的 LAN IP，端口保持不变。

如果 4300 前面挂了反向代理、域名或公网入口，可以显式指定路由 origin：

```bash
SHOW_SCREEN_ROUTE_ORIGIN=https://show.example.com
```

也兼容 `SHOW_PUBLIC_ORIGIN`。设置后，4300 会优先按这个 origin 生成 4302 / 4303 的绝对路由 URL。

## 启动

```bash
npm install
npm run dev
```

打开：

```text
http://<LAN_IP>:4300
```

生产构建：

```bash
npm run build
npm start
```

测试：

```bash
npm test
```

## 现场推荐启动顺序

1. 启动 4300 总控。
2. 启动 4301 DJ。
3. 启动 4302 VJ。
4. 启动 4303 baofa。
5. 每台屏幕机器只打开 `http://<LAN_IP>:4300/screen/<screenId>`。

屏幕 ID：

```text
A1
B1 B2 B3 B4 B5 B6
C1 C2 C3 C4
D1 D2 D3
E1 F1
L1 L2
R1 R2
```

## Dashboard 操作方式

### Visual Control

Visual Control 控制 4302 VJ：

- `setScene`
- `setText`
- `setAudioDrive`
- `setFullscreen`

这些命令通过 `/api/control` 进入 4300，再经 WebSocket 广播给 VJ。屏幕已经路由到 VJ 时，VJ 的 `/screen/<screenId>` 页面也会接收这些命令。

4300 API 仍兼容转发 `setPreset`、`setColors`、`setFx`，但 Dashboard 只保留现场总控需要的高层控制，细节微调在 4302 VJ 控制台完成。

4300 Dashboard 的 VJ 场景选择器与 4302 当前场景集合保持一致：

- `Dumbar`
- `Topology`
- `Liquid`
- `Chromaflux`
- `Blue Font`
- `Cyber`
- `Pulse`
- `Void`

### Multi-screen Interaction

Multi-screen Interaction 控制 4303 baofa 与屏幕路由：

- `Balanced`：A1、L1、L2、R1、R2 给 VJ，其余给 baofa。
- `VJ Takeover`：全部给 VJ。
- `Baofa Takeover`：全部给 baofa。

每个屏幕可单独设置 owner：

- `VJ`：跳转到 4300 后端返回的 4302 绝对 URL
- `Baofa`：跳转到 4300 后端返回的 4303 绝对 URL
- `Off` / `Diag`：停留在 4300 本地状态页

baofa 额外控制：

- `idle / interaction / flow / climax`
- `Pulse`
- `Reset tree`
- `Tree / Firework`
- `Show menus`
- `Show debug`
- `Auto redirect`

当从 `Firework` 切回任意 baofa 模式按钮时，总控会把 `visualMode` 复位为 `tree`，避免烟花模式锁住其它效果。

## 屏幕入口

现场每台屏幕统一打开：

```text
http://<LAN_IP>:4300/screen/A1
http://<LAN_IP>:4300/screen/B3
http://<LAN_IP>:4300/screen/R2
```

4300 会读取当前路由并自动跳转：

- owner 为 `vj`：跳到 4302 VJ screen。
- owner 为 `baofa`：跳到 4303 baofa screen。
- owner 为 `off` 或 `diagnostic`：停留在 4300 状态页。

演出中不需要人工改屏幕 URL。

## API

常用接口：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/state` | 获取完整演出状态 |
| `GET` | `/api/audio-summary` | 获取 DJ 最新音频摘要 |
| `POST` | `/api/mixer/frame` | 兼容旧 DJ 音频帧 |
| `POST` | `/api/modules/:module/state` | 模块状态上报 |
| `POST` | `/api/control` | 发送控制命令 |
| `GET` | `/api/events` | SSE 事件流 |
| `GET` | `/ws` | WebSocket 实时通道 |

WebSocket 主要消息：

- `client.hello`
- `mixer.audioFrame`
- `module.statePatch`
- `control.command`
- `state.snapshot`
- `state.patch`
- `show.patch`
- `control.ack`

同步策略：

- `state.snapshot` 只用于连接、显式 `ui.subscribe` 和重置后的重新基准化。
- 控制命令不会再向所有 WebSocket 客户端广播完整状态，而是广播命令本身、回执和必要的 `state.patch` / `show.patch`。
- dashboard/control-room 接收全量控制与状态增量，用于总控台显示。
- screen-gateway 只接收屏幕路由、拓扑和呈现开关相关的 `interaction` 增量。
- audio/visual/interaction 模块只接收与自身模块相关的控制命令和状态增量。

常用远程控制命令：

- `setMode`
- `setIntensity`
- `resetTree`
- `setVisualMode`
- `setScreen`
- `pulseScreen`
- `setScreenOwner`
- `setScreenRoutePreset`
- `setScreenAutoRedirect`
- `setScreenMenuVisible`
- `setScreenDebugVisible`
- `setScreenPresentation`
- `setFireworkState`

## 鉴权

控制令牌是必要运行条件。`CONTROL_TOKEN` 为空时，写接口与 WebSocket 控制消息会被拒绝；前端控制台 token 为空时不会连接控制通道。

## 部署说明

线上与备用通道的地址、供应商和运行细节不写入公开 README。内部开发者按当前代码默认配置运行，只需在受控环境中填写同一个控制令牌。

## 开发注意

- 端口固定，不自动漂移。
- 现场模式禁用 Vite HMR，避免 HMR WebSocket 端口冲突。
- `tasks/` 是本地任务记录目录，不提交。
- 不要让模块上报未知屏幕 ID；4300 会过滤非现场 20 屏 ID。
