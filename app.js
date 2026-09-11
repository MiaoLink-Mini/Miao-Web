/* 喵连 product page. UI-only interactions; deliberately no Gateway/API calls. */
(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const nav = byId('globalnav');
  const burger = byId('navBurger');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menuLinks = [...nav.querySelectorAll('.globalnav-links a')];

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  menuLinks.forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      burger.focus();
    }
  });
  window.matchMedia('(min-width: 641px)').addEventListener('change', () => setMenu(false));

  let scrollScheduled = false;
  const trackedSections = menuLinks.map((link) => document.querySelector(link.getAttribute('href')));
  function updateScroll() {
    scrollScheduled = false;
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    byId('pageProgress').style.transform = `scaleX(${progress})`;
    let active = -1;
    trackedSections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= 190) active = index;
    });
    menuLinks.forEach((link, index) => {
      link.classList.toggle('is-active', index === active);
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  const scheduleScroll = () => {
    if (!scrollScheduled) {
      scrollScheduled = true;
      window.requestAnimationFrame(updateScroll);
    }
  };
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  updateScroll();

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -20px 0px' });
    document.documentElement.classList.add('has-reveal');
    document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
    document.querySelectorAll('.bento-grid .feature-card').forEach((element, index) => {
      element.style.setProperty('--delay', `${(index % 3) * 60}ms`);
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        revealObserver.disconnect();
        document.documentElement.classList.remove('has-reveal');
      }
    });
  }

  const pointerFine = window.matchMedia('(pointer: fine)');
  document.querySelectorAll('[data-spotlight]').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      if (!pointerFine.matches || reducedMotion.matches) return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - bounds.left}px`);
      card.style.setProperty('--my', `${event.clientY - bounds.top}px`);
    }, { passive: true });
  });

  /* Explicit source filenames; no path heuristics or generated asset names. */
  const shots = Object.freeze({
    home: { src: 'assets/shots/home.png', title: '工作台总览', alt: '喵连 小程序工作台总览，展示设备、会话与待处理事项' },
    sessions: { src: 'assets/shots/sessions.png', title: '统一会话列表', alt: '喵连 小程序会话列表，展示 Codex、Claude Code 和 Pi 会话' },
    session: { src: 'assets/shots/session.png', title: 'Coding 工作台', alt: '喵连 小程序会话详情，展示消息、工具结果、计划与审批' },
    inbox: { src: 'assets/shots/inbox.png', title: '待处理收件箱', alt: '喵连 小程序待处理页面，集中展示需要处理的审批与问题' },
    request: { src: 'assets/shots/request.png', title: '审批处理', alt: '喵连 小程序审批详情，展示更新会话列表样式的请求' },
    login: { src: 'assets/shots/login.png', title: '欢迎页', alt: '喵连 小程序微信认证入口' },
    diff: { src: 'assets/shots/diff.png', title: '代码差异', alt: '喵连 Diff 离线预览，新旧行号与行内变化' },
    share: { src: 'assets/shots/share.png', title: '有效期会话分享', alt: '喵连 会话分享离线预览，只读与协作权限' },
    me: { src: 'assets/shots/me.png', title: '我的工作空间', alt: '喵连 小程序我的页面，展示设置、设备管理与帮助入口' }
  });
  const themeLabels = Object.freeze({ember:'余烬 · Ember',paper:'纸白 · Paper',ocean:'深海 · Ocean',iris:'鸢尾 · Iris',forest:'苔绿 · Moss',mono:'墨黑 · Mono'});
  document.querySelectorAll('[data-theme-preview]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.themePreview;
      if (!Object.hasOwn(themeLabels, key)) return;
      const image = byId('themePreviewImage');
      image.src = 'assets/shots/theme-' + key + '.png';
      image.alt = themeLabels[key] + '主题的会话页面源码预览';
      byId('themePreviewStatus').textContent = themeLabels[key];
      document.querySelectorAll('[data-theme-preview]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    });
  });
  const views = Object.freeze({
    home: { number: '01 / OVERVIEW', title: '打开，就是全局。', description: '设备是否在线，任务跑到哪里，还有什么需要你决定。一个工作台，把分散的进展重新聚拢。', benefits: ['设备与会话，集中查看', '待处理事项，不再遗漏', '从进度直接进入下一步'] },
    sessions: { number: '02 / SESSIONS', title: '不同 Agent，同一个入口。', description: 'Codex、Claude Code、Pi 的会话集中呈现。按设备、项目、Agent 与状态查找，不必来回切换终端窗口。', benefits: ['跨设备会话，统一查看', '搜索与筛选，直达目标', '实际能力，按设备展示'] },
    request: { number: '03 / APPROVALS', title: '需要你时，再出手。', description: '看清是什么请求、来自哪台设备、属于哪个会话。你的决定通过网关送回本机，以服务端回执为准。', benefits: ['请求上下文，一屏呈现', '授权选项，以实际能力为准', '区分已送达、已确认与结果未知'] },
    session: { number: '04 / CODING', title: '让整个过程，有迹可循。', description: '消息、工具调用与代码差异，各有清晰的层级。读历史不被打断，回到最新才继续跟随。', benefits: ['关键事件，结构化呈现', '流式消息，跟上执行进度', '重连补齐事件，不重复执行任务'] }
  });
  let activeView = 'home';
  const tabs = [...document.querySelectorAll('[data-view]')];
  function selectView(key, moveFocus = false) {
    if (!Object.hasOwn(views, key)) return;
    const view = views[key];
    activeView = key;
    tabs.forEach((tab) => {
      const selected = tab.dataset.view === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    });
    byId('workspaceView').setAttribute('aria-labelledby', `tab-${key}`);
    byId('viewNumber').textContent = view.number;
    byId('viewTitle').textContent = view.title;
    byId('viewDescription').textContent = view.description;
    byId('viewBenefits').replaceChildren(...view.benefits.map((text) => {
      const row = document.createElement('span');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'icon');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#i-check');
      svg.append(use);
      row.append(svg, document.createTextNode(text));
      return row;
    }));
    const shot = shots[key];
    byId('workspaceShot').src = shot.src;
    byId('workspaceShot').alt = shot.alt;
    byId('phonePreview').setAttribute('aria-label', `放大${shot.title}截图`);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectView(tab.dataset.view));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectView(tabs[next].dataset.view, true);
    });
  });

  /* Local illustration only. Never produces a Gateway request or a fake remote receipt. */
  document.querySelectorAll('[data-decision]').forEach((button) => {
    button.addEventListener('click', () => {
      const allowed = button.dataset.decision === 'allow';
      const status = byId('approvalStatus');
      status.className = `approval-status ${allowed ? 'allowed' : 'denied'}`;
      status.replaceChildren(document.createElement('i'), document.createTextNode(allowed ? '演示：已选择允许一次' : '演示：已选择拒绝'));
      byId('approvalActions').hidden = true;
      byId('resetApproval').hidden = false;
      byId('approvalLive').textContent = `${allowed ? '允许' : '拒绝'}交互演示已完成。没有发送真实指令。`;
      byId('resetApproval').focus({ preventScroll: true });
    });
  });
  byId('resetApproval').addEventListener('click', () => {
    const status = byId('approvalStatus');
    status.className = 'approval-status';
    status.replaceChildren(document.createElement('i'), document.createTextNode('等待你的决定'));
    byId('approvalActions').hidden = false;
    byId('resetApproval').hidden = true;
    byId('approvalLive').textContent = '本地审批演示已重置。';
    document.querySelector('[data-decision="allow"]').focus({ preventScroll: true });
  });

  const agents = Object.freeze({
    codex: { name: 'Codex', protocol: 'APP SERVER / JSON-RPC' },
    claude: { name: 'Claude Code', protocol: 'OFFICIAL AGENT SDK' },
    pi: { name: 'Pi', protocol: 'RPC + WEAGENT EXTENSION' }
  });
  byId('orbitStage').dataset.activeAgent = 'codex';
  document.querySelectorAll('[data-orbit-agent]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.orbitAgent;
      if (!Object.hasOwn(agents, key)) return;
      byId('orbitStage').dataset.activeAgent = key;
      document.querySelectorAll('[data-orbit-agent]').forEach((other) => {
        const selected = other === button;
        other.classList.toggle('is-selected', selected);
        other.setAttribute('aria-pressed', String(selected));
      });
      byId('orbitAgentName').textContent = agents[key].name;
      byId('orbitAgentProtocol').textContent = agents[key].protocol;
      window.dispatchEvent(new CustomEvent('weagent:agent-change', { detail: { key } }));
    });
  });

  const dialogs = [...document.querySelectorAll('dialog')];
  const returnFocus = new WeakMap();
  function openDialog(dialog) {
    if (dialog.open) return;
    setMenu(false);
    returnFocus.set(dialog, document.activeElement);
    dialog.showModal();
  }
  dialogs.forEach((dialog) => {
    dialog.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => dialog.close()));
    /* Only close on a genuine backdrop click, not an inner-content drag release. */
    let pointerStartedOutside = false;
    const isOutside = (event) => {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    dialog.addEventListener('pointerdown', (event) => { pointerStartedOutside = event.target === dialog && isOutside(event); });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && pointerStartedOutside && isOutside(event)) dialog.close();
      pointerStartedOutside = false;
    });
    dialog.addEventListener('close', () => {
      const target = returnFocus.get(dialog);
      if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
    });
  });
  document.querySelectorAll('[data-open-guide]').forEach((button) => button.addEventListener('click', () => {
    byId('copyStatus').textContent = '';
    openDialog(byId('guideDialog'));
  }));
  function selectShot(key) {
    if (!Object.hasOwn(shots, key)) return;
    byId('galleryImage').src = shots[key].src;
    byId('galleryImage').alt = shots[key].alt;
    byId('galleryTitle').textContent = shots[key].title;
    document.querySelectorAll('[data-shot]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.shot === key)));
  }
  function openGallery() {
    selectShot(activeView);
    openDialog(byId('galleryDialog'));
  }
  byId('openGallery').addEventListener('click', openGallery);
  byId('phonePreview').addEventListener('click', openGallery);
  document.querySelectorAll('[data-open-shot]').forEach(button => button.addEventListener('click', () => {
    if (!Object.hasOwn(shots, button.dataset.openShot)) return;
    selectShot(button.dataset.openShot);
    openDialog(byId('galleryDialog'));
  }));
  document.querySelectorAll('[data-shot]').forEach((button) => button.addEventListener('click', () => selectShot(button.dataset.shot)));

  const installCommands = Object.freeze({
  "posix": "d=$(mktemp -d) && curl -fsSL https://agent.000.moe/downloads/node/install.mjs -o \"$d/install.mjs\" && node \"$d/install.mjs\"",
  "windows": "$p=Join-Path $env:TEMP ('miaolian-'+[guid]::NewGuid()+'.mjs'); Invoke-WebRequest https://agent.000.moe/downloads/node/install.mjs -OutFile $p; if ($?) { node $p }"
});
  let commandRevision = 0;
  document.querySelectorAll('[data-install-platform]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.installPlatform;
      if (!Object.hasOwn(installCommands, key)) return;
      commandRevision++;
      byId('nodeCommand').textContent = installCommands[key];
      byId('copyStatus').textContent = '';
      document.querySelectorAll('[data-install-platform]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    });
  });
  byId('guideDialog').addEventListener('close', () => { commandRevision++; });
  byId('copyCommand').addEventListener('click', async () => {
    const text = byId('nodeCommand').textContent, revision = ++commandRevision;
    let success = false;
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px';
        byId('guideDialog').append(textarea);
        try { textarea.select(); success = document.execCommand('copy'); }
        finally { textarea.remove(); }
        byId('copyCommand').focus({ preventScroll: true });
      }
    } catch { success = false; }
    if (revision !== commandRevision || !byId('guideDialog').open) return;
    byId('copyStatus').textContent = success ? '已复制，在解压后的工程根目录执行。' : '浏览器未允许复制，请手动选择上方命令后复制。';
  });

  document.querySelectorAll('.faq').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (details.open) document.querySelectorAll('.faq').forEach((other) => { if (other !== details) other.open = false; });
    });
  });
})();
