# 验证报告

## 已完成

| 检查 | 结果 |
| --- | --- |
| JavaScript 语法：app.js、scene.js、serve.mjs、vendor.mjs | 通过 |
| 页面 ID 与本地资源引用 | 62 个唯一 ID；16 个静态资源引用通过 |
| 原始小程序截图 | 7 张，逐字节和 SHA-256 校验一致 |
| 离线界面浏览器检查 | 14 项通过，0 项失败 |
| 响应式横向溢出 | 320 / 390 / 640 / 768 / 1024 / 1440 / 1920 全部通过 |
| 本地 HTTP 服务与资源 | Python HTTP 客户端执行 20 项检查通过 |

浏览器版本：Chromium 144.0.7559.96。完整机器可读结果为 `ui-report.json` 与 `http-report.json`。

离线界面检查包含：页面非空、降级场景、三个 Agent 标签、四个工作台视图与方向键切换、七张原图、弹窗 Escape 与焦点恢复、审批允许／拒绝／重置、指南与复制反馈、五项 FAQ、移动菜单、减少动态效果、无 JavaScript 正文可读。

界面检查未出现未捕获 JavaScript 异常或控制台 error。控制台有一条预期 warning，明确说明依赖被测试装载器省略并进入静态降级。复制检查验证了界面反馈，没有读取系统剪贴板来证明内容。

## 环境限制与实际方法

当前运行环境无法下载外部 npm/CDN 依赖，且 Chromium 管理策略阻止 URL 导航。agent-browser 命令不存在；本次使用已安装的 Playwright 与 Chromium。未修改浏览器管理策略。

HTTP 服务确实启动，并由本地 HTTP 客户端检查页面、脚本、样式、图片的状态和 MIME 类型。但浏览器没有经 HTTP 导航完成端到端加载。

浏览器视觉与交互检查使用 `tests/offline_fixture.py`，将本地 HTML、CSS、JS 和图片内联进空白文档。为了准确检验失败分支，测试装载器明确省略真实 Three.js 依赖并触发加载错误。没有伪造 Three.js 类、WebGLRenderer 或成功标记。交付源文件的实际 CDN 加载器没有被测试装载器改写。

## 尚未验收

真实 Three.js 库下载和安装、本地 vendor 真实源包流程、实际 WebGL2 场景和着色器编译、GPU 性能、3D 拾取和拖动、图形上下文恢复，均不能从上述离线检查推导为已通过。

Safari、真实 Android / iOS / 微信 WebView、生产网关和真实 Agent 操作不在本次已完成验证范围内。

## 预览图

随附桌面和移动端预览均为真实 Chromium 渲染的页面，但首屏显示的是 **CSS 静态降级轨道**，不是已经运行成功的 Three.js 帧。全页截图使用系统减少动态效果设置，让未进入视口的内容正常展示。

## 真实环境复验

按根目录 README 执行 `npm ci` 与 `npm run vendor` 后启动页面，再执行：

```sh
python tests/verify_ui.py --url http://127.0.0.1:8080 --require-three
```

检查 `docs` 之外新生成的 `tests/results/ui-report.json`。真实场景成功时页面节点会具有 `data-renderer=three` 和 `data-three-revision`；失败时则是 `data-renderer=fallback`。不要只凭页面有一个球形视觉就判断 Three.js 已运行。
