# WeAgent-Web · 产品介绍页

苹果风格的 WeAgent 产品介绍落地页（Apple 风格：黑色画布、大标题排版、渐变点缀、磨砂导航、Bento 功能网格）。

页面中的产品图均为**微信小程序真实页面截图**（通过微信开发者工具 CLI + miniprogram-automator 自动化截取，见 `tools/`），非手绘 mockup。

纯静态实现，**零依赖、无需构建**：

```
WeAgent-Web/
├── index.html        # 页面结构与文案
├── styles.css        # 设计系统（苹果风格 + Monochrome 深色品牌规范）
├── app.js            # 滚动 reveal 动效、导航、FAQ 手风琴
├── assets/shots/     # 小程序真实页面截图（自动化截取）
│   ├── login.png     # 欢迎页（Hero 辅机）
│   ├── session.png   # 会话详情 · 混合时间线（Hero 主机）
│   ├── request.png   # 审批处理（审批区）
│   ├── inbox.png     # 待处理收件箱（审批区辅机）
│   ├── sessions.png  # 会话列表（统一会话区）
│   ├── home.png / me.png  # 总览 / 我的（备用）
│   └── ...
├── tools/            # 截图自动化脚本（node tools/shot.js）
└── README.md
```

## 重新截取真实截图

前置：本机安装微信开发者工具，并在「设置 → 安全设置」开启服务端口，工具处于登录状态。

```bash
# 1. 开启项目自动化端口
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto \
  --project "C:\Users\abc\Desktop\WeAgent-Frontend\WeAgent-Frontend" --auto-port 9420

# 2. 连接并截图（产出至 assets/shots/）
cd tools && npm i && node shot.js && node shot2.js
```

## 本地预览

直接双击 `index.html` 即可在浏览器打开；或起一个本地服务：

```bash
cd WeAgent-Web
python -m http.server 8080
# 打开 http://localhost:8080
```

## 页面结构

| 区块 | 内容 |
| --- | --- |
| 导航 | 磨砂全局导航 + 「立即体验」CTA，移动端汉堡菜单 |
| Hero | 大标题「Coding Agent，一手掌控。」+ 真实截图双机组合（会话时间线 + 欢迎页） |
| Agent 适配条 | Codex · Claude Code · Pi · DeepSeek Harness · OpenCode · Generic PTY |
| 功能大字报 | 移动审批收件箱（真实截图）/ 统一会话列表（真实截图）/ 混合时间线（10 类事件） / Diff 摘要卡 |
| Bento 网格 | 设备配对、创建会话、运行控制、Plan、用量、断线恢复、斜杠命令 |
| 安全 | 「密钥永不离开你的设备」：零密钥存储 / 全量审计 / TLS |
| 技术架构 | 手机/浏览器 → Gateway(Go) → Node Daemon → Coding Agents 架构图 |
| FAQ · CTA · 页脚 | 手风琴常见问题 + 渐变 CTA + 苹果式小字页脚 |

文案口径取自 `frontend-design.md` / `backend-design.md` / `frontend-function-inventory.md`（功能域、事件类型、协议等均为文档既有设计，未杜撰数据）。

## 待接入的真实链接

- CTA「打开 WeAgent 小程序」当前为 `#` 占位
- 页脚「API 契约 / 部署指南 / 联系我们 / 更新日志」为占位
- 后续 WeAgent-Web 正式前端（如 React/Next）落地后，可将本页迁移为 `/` 路由

## 设计规范

- 画布 `#000000`，卡片 `#0d0d0f`，主文字 `#f5f5f7`，次文字 `#a1a1a6`（与小程序 Monochrome 主题一致）
- 强调色：苹果蓝 `#2997ff` / 按钮 `#0071e3`，签名渐变 `#64d2ff → #2997ff → #bf5af2 → #ff6482`
- 字体栈：SF Pro / PingFang SC 优先，等宽用 SF Mono
- 支持深色背景下的滚动浮现动效，并尊重 `prefers-reduced-motion`
