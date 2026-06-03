# HANDOFF

## 2026-06-01
- [Dashboard Route Panel Reflow](tasks/2026-06-01-dashboard-route-panel-reflow.md): 头部日志重排、VJ/DJ 有效操作抽出、右侧路由栏滚动修复和空间压缩。

## 2026-06-02
- [Route and Live Control Alignment](tasks/2026-06-02-route-and-live-control-alignment.md): 路由五档内置化、DJ style/shuffle、VJ 11 场景、Baofa Roam/reset/status 对齐。
- [External Route Wrapper and Baofa Camera Alignment](tasks/2026-06-02-external-route-wrapper-and-baofa-camera.md): 外部路由由 4300 网关承载并支持顶层外链回跳、矩阵状态图标化、摄像头开关与 4303 对齐。
- [Cloudflare Custom Route Arrangements](tasks/2026-06-02-cloudflare-custom-route-arrangements.md): 修复线上 Cloudflare Worker 对自定义路由编排保存、切换、删除命令的处理。
- [Rollback v3 to b24ffb2](tasks/2026-06-02-rollback-v3-to-b24ffb2.md): v3 已强制回退到 b24ffb2；main 回退分支已准备但因 build:worker 类型检查失败暂停合并确认。

## 2026-06-04
- [Route Recovery and External Link Retreat](tasks/2026-06-04-route-recovery-and-external-link-retreat.md): 恢复 4300 worker 默认状态结构，收回 checkin/gallery/echo 外链路由，关闭公网 Firebase 自动回退，测试已通过。
