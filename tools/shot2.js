/** 补拍会话详情页（时间线核心页） */
const path = require("path");
const fs = require("fs");
const automator = require("miniprogram-automator");

const OUT = path.join(__dirname, "..", "assets", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
  try {
    await miniProgram.switchTab("/pages/sessions/index");
    await sleep(800);
    const page = await miniProgram.currentPage();
    console.log("page:", page.path);

    // 优先点击第一张会话卡片
    let tapped = false;
    const card = await page.$("session-card");
    if (card) {
      await card.tap();
      tapped = true;
    } else {
      // 兜底：从页面数据里取会话 id 直达
      const data = await page.data();
      const first = data.list && data.list[0];
      if (first) {
        await miniProgram.navigateTo("/pages/session/index?id=" + first.id);
        tapped = true;
      }
    }
    if (!tapped) throw new Error("无法进入会话详情：未找到会话数据");

    await sleep(1500);
    const detail = await miniProgram.currentPage();
    console.log("detail page:", detail.path);
    await miniProgram.screenshot({ path: path.join(OUT, "session.png") });
    console.log("shot: session");
  } finally {
    await miniProgram.disconnect();
  }
  console.log("done.");
}

main().catch((e) => {
  console.error("FAILED:", e && e.message);
  process.exit(1);
});
