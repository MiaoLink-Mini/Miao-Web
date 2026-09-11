# 喵连 Web

喵连 Web 是一个静态产品介绍页和交互式界面预览。页面展示喵连小程序的工作台、会话、审批、设备连接和 Agent 适配能力；页面中的审批、切换和截图浏览均为本地演示，不连接真实 Gateway，也不会执行远程操作。

## 本地运行

需要 Node.js 18 或更高版本：

```sh
cd Miao-Web
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

打开 <http://127.0.0.1:8080>。端口可以通过 `PORT` 环境变量修改，例如：

```sh
PORT=9090 npm start
```

预览服务器只监听本机地址，并且只发布网页、脚本、样式、图片和已审核的 Three.js 文件。它会拒绝访问项目配置、依赖目录、隐藏文件、目录和符号链接，因此不应用作生产文件服务器。

## Three.js 场景

页面默认使用固定版本 `three@0.185.1` 的 CDN 模块。需要离线运行或不使用 CDN 时，可以安装依赖并生成本地 vendor 文件：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run vendor
npm start
```

`npm run vendor` 会检查依赖版本，复制实际 ESM 构建文件和许可证，并更新加载器。WebGL 初始化失败时，页面会自动显示静态场景，不影响其余内容和交互。

## 资源和图标

- `assets/golink.png`：喵连猫咪终端产品图标，兼容现有页面资源路径。
- `assets/mark.svg`：网页标识 SVG。
- `assets/shots/`：小程序界面预览图，包括总览、会话、审批、Diff 和分享等页面。
- `docs/asset-manifest.json`：预览图与来源资源的校验信息。

截图是离线渲染的虚构演示数据，不是真机截图，也不包含真实会话、凭据或用户数据。需要重新生成截图时，应在包含 `Miao-Frontend` 的完整工作区中运行对应导出脚本，并同步更新资源清单。

## 检查和测试

```sh
npm run check
npm test
```

`npm run check` 检查前端脚本语法；`npm test` 运行资源生命周期、预览服务器和页面交互测试。需要浏览器验证时，可先启动本地服务器，再运行：

```sh
python tests/verify_ui.py --url http://127.0.0.1:8080
```

该测试默认允许 Three.js 场景或静态回退场景。使用 `--require-three` 时，必须提供可用的浏览器 WebGL 环境。

## 目录说明

```text
Miao-Web/
├─ index.html              页面结构和文案
├─ styles.css              页面样式与响应式布局
├─ app.js                  本地交互逻辑
├─ src/                    Three.js 场景和资源生命周期管理
├─ assets/                 图标与界面预览图
├─ scripts/                本地服务器和 vendor 工具
├─ tests/                  自动化测试
└─ docs/                   资源清单和验证记录
```

本项目是静态 Web 预览，不包含 Gateway 服务、账号系统或真实 Agent 执行逻辑。
