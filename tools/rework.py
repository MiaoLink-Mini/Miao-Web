# -*- coding: utf-8 -*-
"""把落地页的 CSS mockup 替换为小程序真实截图"""
import io

HTML = r"C:\Users\abc\Desktop\WeAgent-Frontend\WeAgent-Web\index.html"
CSS = r"C:\Users\abc\Desktop\WeAgent-Frontend\WeAgent-Web\styles.css"

NEW_HERO = """<!-- 真实截图：会话时间线（主） + 欢迎页（辅） -->
    <div class="hero-stage reveal">
      <div class="shot-phone shot-back" aria-hidden="true">
        <img src="assets/shots/login.png" alt="" loading="lazy">
      </div>
      <div class="shot-phone shot-main">
        <img src="assets/shots/session.png" alt="GoLink 小程序会话详情截图：混合时间线展示消息、工具调用、执行计划与审批卡片">
      </div>
      <div class="float-chip chip-1">推送 · <b>审批已送达</b></div>
      <div class="float-chip chip-2">多端实时同步</div>
    </div>
  """

NEW_INBOX_VISUAL = """<div class="shot-duo" aria-hidden="true">
        <div class="shot-phone shot-back">
          <img src="assets/shots/inbox.png" alt="" loading="lazy">
        </div>
        <div class="shot-phone shot-main">
          <img src="assets/shots/request.png" alt="" loading="lazy">
        </div>
      </div>
    </div>
  </div>
</section>"""

NEW_SESSION_VISUAL = """<div class="shot-single" aria-hidden="true">
        <div class="shot-phone shot-main">
          <img src="assets/shots/sessions.png" alt="" loading="lazy">
        </div>
      </div>
    </div>
  </div>
</section>"""

NEW_HERO_CSS = """/* ---------------- Hero 舞台：真实截图手机壳 ---------------- */

.hero-stage {
  position: relative;
  max-width: 920px;
  margin: 0 auto;
  padding: 34px 0 64px;
  display: flex;
  justify-content: center;
}

.shot-phone {
  position: relative;
  flex-shrink: 0;
  border-radius: 46px;
  border: 7px solid #2e2e33;
  background: #000;
  box-shadow: 0 44px 110px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.07),
    0 0 80px rgba(41, 151, 255, 0.09);
  overflow: hidden;
  line-height: 0;
}

.shot-phone img {
  width: 100%;
  height: auto;
  display: block;
}

.hero-stage .shot-main {
  width: 332px;
  z-index: 2;
}

.hero-stage .shot-back {
  position: absolute;
  width: 288px;
  left: calc(50% - 374px);
  top: 96px;
  transform: rotate(-8deg);
  opacity: 0.92;
  z-index: 1;
  filter: brightness(0.8);
}

/* 浮动信息 chip */
.float-chip {
  position: absolute;
  z-index: 4;
  font-size: 12px;
  color: var(--text-2);
  background: rgba(20, 20, 22, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  padding: 7px 14px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
  animation: phone-float 9s ease-in-out infinite;
  white-space: nowrap;
}

.float-chip b { color: var(--text-1); font-weight: 600; }

.chip-1 { top: 46px; left: 84px; animation-delay: 1.2s; }
.chip-2 { bottom: 64px; right: -6px; animation-delay: 0.4s; }

@keyframes phone-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

"""

NEW_SHOT_CSS = """/* 真实截图 visual：审批双机 / 会话单机 */
.shot-duo {
  display: flex;
  justify-content: center;
  position: relative;
  padding: 16px 0;
}

.shot-duo .shot-main { width: 296px; z-index: 2; }

.shot-duo .shot-back {
  position: absolute;
  width: 252px;
  right: calc(50% - 316px);
  top: 80px;
  transform: rotate(8deg);
  opacity: 0.92;
  z-index: 1;
  filter: brightness(0.8);
}

.shot-single {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.shot-single .shot-main { width: 306px; }

"""

OLD_MOBILE = """  /* hero 舞台纵向堆叠 */
  .hero-stage { padding: 0 0 30px; }
  .desk-window { transform: none; }
  .win-side { display: none; }
  .win-body { min-height: 0; }
  .phone {
    position: relative;
    bottom: auto;
    left: auto;
    margin: -60px auto 0;
    width: 218px;
    animation: none;
  }
  .float-chip { display: none; }
  .evt:nth-child(n) { animation-delay: 0s; }"""

NEW_MOBILE = """  /* 真实截图手机：只保留主机 */
  .hero-stage { padding: 8px 0 26px; }
  .shot-back { display: none; }
  .hero-stage .shot-main { width: 262px; }
  .shot-duo .shot-main { width: 258px; }
  .shot-single .shot-main { width: 262px; }
  .float-chip { display: none; }"""

OLD_REDUCED = ".evt, .phone, .float-chip, .bars-demo i.is-live { animation: none !important; }"
NEW_REDUCED = ".float-chip, .bars-demo i.is-live { animation: none !important; }"
OLD_900 = "\n  .inbox-stack, .session-list { max-width: none; }"


def replace_region(s, start_marker, end_marker, new, keep_end=True):
    a = s.index(start_marker)
    b = s.index(end_marker, a)
    if keep_end:
        return s[:a] + new + s[b:]
    return s[:a] + new + s[b + len(end_marker):]


# ---------- HTML ----------
with io.open(HTML, encoding="utf-8") as f:
    html = f.read()

html = replace_region(html, "<!-- 产品界面 Mockup：桌面窗口 + 手机 -->", "<!-- 适配 Agent -->", NEW_HERO)

a = html.index('<div class="inbox-stack"')
b = html.index("</section>", a) + len("</section>")
html = html[:a] + NEW_INBOX_VISUAL + html[b:]

a = html.index('<div class="session-list"')
b = html.index("</section>", a) + len("</section>")
html = html[:a] + NEW_SESSION_VISUAL + html[b:]

with io.open(HTML, "w", encoding="utf-8", newline="\n") as f:
    f.write(html)

# ---------- CSS ----------
with io.open(CSS, encoding="utf-8") as f:
    css = f.read()

css = replace_region(css, "/* ---------------- Hero 舞台", "/* ---------------- Agent 适配条", NEW_HERO_CSS)
css = replace_region(css, "/* 审批收件箱 visual */", "/* 事件墙 */", NEW_SHOT_CSS)
assert OLD_MOBILE in css
css = css.replace(OLD_MOBILE, NEW_MOBILE)
assert OLD_REDUCED in css
css = css.replace(OLD_REDUCED, NEW_REDUCED)
if OLD_900 in css:
    css = css.replace(OLD_900, "")

with io.open(CSS, "w", encoding="utf-8", newline="\n") as f:
    f.write(css)

print("HTML bytes:", len(html))
print("CSS bytes:", len(css))
print("ok")
