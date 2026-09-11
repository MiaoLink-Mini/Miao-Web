# 官网更新与部署（2026-09-07）

后续状态：新服务器后端已完成部署，原 `/v1/` 503 占位已替换为真实 Gateway；详情见 `WeAgent-Backend/docs/deployment-20260907.md`。以下首次 Web 部署范围为历史记录。

## 示例图缓存修复（后续发布）

- 当前版本为 `20260907-web-449244c9`，源站不变。
- 9 张主展示图统一使用小程序默认余烬主题；主题色栏目继续提供六种独立配色。
- 发布脚本 `scripts/build-release.py` 为图片、CSS、JS 和模块使用内容摘要版本目录 `/_assets/<digest>/`，避免复用旧资源 URL。
- 首页使用 `Cache-Control: no-store, no-cache, must-revalidate`；独立版本资源可长期缓存。
- 旧公开资源保留，避免已打开的旧页面出现资源 404；上一版本目录保留以便回滚。
- 新资源路径下 15 张图片已逐一与导出清单比对 SHA-256。
- 若访问者仍保留旧首页缓存，可使用 `https://agent.000.moe/?v=449244c9` 进入新版本；无法由源站主动清除已存入浏览器的旧页面缓存。

## 当前部署

- 域名：`https://agent.000.moe`
- 新源站：`8.209.221.97`；本次没有连接或修改旧服务器。
- 版本：`20260907-web-theme-share`，通过响应头 `X-WeAgent-Release` 核验。
- 静态发布目录：`/opt/weagent-web/releases/20260907-web-theme-share`。
- 当前版本链接：`/opt/weagent-web/current`。
- Nginx 配置：`/etc/nginx/sites-available/weagent-web`；原始配置备份在 `/opt/weagent-web/backups`。
- 源站 HTTPS 使用 Let's Encrypt，证书到期日为 2026-12-06，已配置 Certbot 自动续期及 Nginx 重载钩子。
- 仅上传公开 HTML/CSS/JS、图片及本地 Three.js 依赖，不上传源码仓库、私密配置或数据库。

## 更新内容

- 从当前小程序 WXML/WXSS 重新生成 15 张示例图：原有 9 张与 6 张同一会话的主题预览。
- 新增「主题色」栏目：余烬、纸白、深海、鸢尾、苔绿、墨黑；按钮可切换示例图。
- 新增「分享」栏目：会话权限、有效期、撤销及协作记录说明；点击图片可放大。
- 示例图使用隔离虚构数据与离线近似渲染，不冒充微信真机截图。

## 验证

- Web JavaScript 检查通过，18 个现有单元测试通过。
- 图片来源摘要、新鲜度及尺寸验证通过；公网 15 张图片 SHA-256 与本地导出清单完全相同。
- 公网浏览器验证：6 种主题切换、分享弹窗、320/390/640/768/1024/1440/1920 宽度无横向溢出；无页面 JavaScript 异常。
- `/.env`、`/package.json`、`/private/gateway.env`、`/scripts/export-shots.py` 均返回 404。
- 测试入口：`tests/verify_theme_share.py --url https://agent.000.moe --browser <浏览器路径>`。

## 范围与回滚

本轮按要求先部署 Web。新服务器尚未部署 Gateway、数据库或 Node，`/v1/` 明确返回 503，不代理至旧服务器。官网交互不发送真实 Agent 指令。

后续静态版本应上传至新的版本目录，验证后原子切换 `current` 链接；回滚仅切回保留的上一版本，不删除发布目录或运行数据。本次为空服务器的首次官网部署，没有上一份 WeAgent 官网可回滚。

本轮浏览器验收覆盖新增栏目，不替代完整 WebGL 动画生命周期验收；此前完整检查中的暂停画面像素稳定性问题仍需单独排查。
