/**
 * 用微信开发者工具自动化截取 GoLink 小程序真实页面
 * 产物: WeAgent-Web/assets/shots/*.png
 */
const path = require("path");
const fs = require("fs");
const automator = require("miniprogram-automator");

const CLI = "C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat";
const PROJECT = "C:\\Users\\abc\\Desktop\\WeAgent-Frontend\\WeAgent-Frontend";
const OUT = path.join(__dirname, "..", "assets", "shots");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(miniProgram, name) {
  await sleep(900); // 等待渲染稳定
  const file = path.join(OUT, name + ".png");
  await miniProgram.screenshot({ path: file });
  console.log("shot:", name);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("connecting to ws://127.0.0.1:9420 ...");
  const miniProgram = await automator.connect({
    wsEndpoint: "ws://127.0.0.1:9420",
  });
  console.log("connected.");

  try {
    // 0. 回到欢迎页，保证每次截屏状态一致
    await miniProgram.reLaunch("/pages/login/index");
    await sleep(1200);

    // 1. 登录欢迎页
    let page = await miniProgram.currentPage();
    console.log("entry page:", page.path);
    await shot(miniProgram, "login");

    // 2. 进入演示工作台（触发演示登录 -> switchTab 到总览）
    const enterBtn = await page.$(".primary");
    if (enterBtn) {
      await enterBtn.tap();
      await sleep(1500);
    }
    page = await miniProgram.currentPage();
    console.log("after login:", page.path);

    // 3. 总览
    await shot(miniProgram, "home");

    // 4. 会话列表
    await miniProgram.switchTab("/pages/sessions/index");
    await shot(miniProgram, "sessions");

    // 5. 会话详情：点击第一张会话卡片
    const card = await page.$("session-card");
    if (card) {
      await card.tap();
      await sleep(1500);
      page = await miniProgram.currentPage();
      console.log("session detail:", page.path);
      await shot(miniProgram, "session");
    } else {
      console.log("no session-card found on sessions page");
    }

    // 6. 待处理收件箱
    await miniProgram.switchTab("/pages/inbox/index");
    await sleep(600);
    page = await miniProgram.currentPage();
    await shot(miniProgram, "inbox");

    // 7. 审批处理页：点击待处理里的第一项
    const item = await page.$(".item, .card, .list > view");
    if (item) {
      await item.tap();
      await sleep(1500);
      page = await miniProgram.currentPage();
      console.log("after inbox tap:", page.path);
      if (page.path.indexOf("request") >= 0) {
        await shot(miniProgram, "request");
      }
    }

    // 8. 我的
    await miniProgram.switchTab("/pages/me/index");
    await shot(miniProgram, "me");
  } finally {
    await miniProgram.disconnect();
  }
  console.log("done.");
}

main().catch((e) => {
  console.error("FAILED:", e && e.message);
  process.exit(1);
});
