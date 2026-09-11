import { ResourceScope } from './resource-scope.js';
/*
 * 喵连 orbital scene / Three.js 0.185.1.
 * Procedural geometry only: no external textures, models, analytics or Gateway requests.
 * The loader can be switched to the locally vendored build by `npm run vendor`.
 */
const stage = document.getElementById('orbitStage');
const mount = document.getElementById('sceneMount');
const status = document.getElementById('sceneStatus');
const motionButton = document.getElementById('motionToggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let application = null;

function showFallback(message) {
  stage.classList.remove('has-webgl');
  stage.dataset.renderer = 'fallback';
  status.textContent = 'STATIC ORBIT / 静态预览';
  status.title = message;
  motionButton.disabled = true;
  motionButton.setAttribute('aria-label', '静态场景：3D 动画不可用');
  motionButton.querySelector('span').textContent = '静态';
}

const loadingNotice = window.setTimeout(() => {
  if (!application) showFallback('3D 模块仍在加载。静态视觉和页面功能可继续使用。');
}, 10000);

try {
  const THREE = await import('../vendor/three-loader.js');
  window.clearTimeout(loadingNotice);
  application = createOrbit(THREE);
} catch (error) {
  window.clearTimeout(loadingNotice);
  showFallback('Three.js 或 WebGL2 未能初始化。请检查依赖加载与浏览器图形加速；页面已安全降级。');
  console.warn('[喵连 scene] Static fallback:', error instanceof Error ? error.message : String(error));
}

function createOrbit(THREE) {
  const scope = new ResourceScope();
  const own = resource => scope.track(resource);
  let renderer = null, disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    // Stop callbacks first; cleanup itself continues if one disposer throws.
    try { renderer?.setAnimationLoop(null); } catch (_) { /* Continue releasing resources. */ }
    const errors = scope.dispose();
    if (errors.length) console.warn('[喵连 scene] Cleanup errors:', errors.map(error => String(error)));
  }
  try {
    const compact = () => window.innerWidth <= 640;
    const canvas = document.createElement('canvas');
    scope.defer(() => canvas.remove());
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) throw new Error('WebGL2 is unavailable');
    scope.defer(() => context.getExtension('WEBGL_lose_context')?.loseContext());
    renderer = own(new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' }));
    renderer.setClearColor(0x080b09, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    mount.append(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 80);
    const root = new THREE.Group();
    root.position.y = 0.34;
    scene.add(root);
    const globe = new THREE.Group();
    root.add(globe);

    const palette = Object.freeze({ codex: 0xc3ff86, claude: 0xeaaa87, pi: 0x8ae8cb });
    const initialKey = stage.dataset.activeAgent;
    const accent = new THREE.Color(Object.hasOwn(palette, initialKey) ? palette[initialKey] : palette.codex);
    const targetAccent = accent.clone();
    const neutralLightColor = new THREE.Color(0xffffff);
    const ambient = new THREE.AmbientLight(0x83a178, 1.2);
    const keyLight = new THREE.DirectionalLight(0xddffb3, 3.8);
    keyLight.position.set(3.8, 4.5, 4);
    const fillLight = new THREE.DirectionalLight(0x3d8268, 2.2);
    fillLight.position.set(-4, -1.5, 2.5);
    const rimLight = new THREE.PointLight(0xc7ffa4, 38, 15, 2);
    rimLight.position.set(1.8, 2.1, -1.8);
    scene.add(ambient, keyLight, fillLight, rimLight);

    const coreGeometry = own(new THREE.IcosahedronGeometry(1.13, compact() ? 3 : 4));
    const coreMaterial = own(new THREE.MeshPhysicalMaterial({
      color: 0x112819, metalness: 0.76, roughness: 0.34,
      clearcoat: 0.8, clearcoatRoughness: 0.22,
      emissive: 0x0a1f0b, emissiveIntensity: 0.24
    }));
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    globe.add(core);
    const facetSource = own(new THREE.IcosahedronGeometry(1.142, 2));
    const facets = new THREE.LineSegments(
      own(new THREE.WireframeGeometry(facetSource)),
      own(new THREE.LineBasicMaterial({ color: 0xabc98a, transparent: true, opacity: 0.085, depthWrite: false }))
    );
    scope.release(facetSource);
    globe.add(facets);

    /* Latitude/longitude lines are genuine 3D geometry, not a sphere image. */
    const gridMaterial = own(new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.20, depthWrite: false }));
    const gridRadius = 1.15;
    for (let latitude = -5; latitude <= 5; latitude++) {
      const angle = latitude * Math.PI / 12;
      const radius = Math.cos(angle) * gridRadius;
      const y = Math.sin(angle) * gridRadius;
      const points = [];
      for (let j = 0; j < 96; j++) {
        const a = j / 96 * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
      }
      globe.add(new THREE.LineLoop(own(new THREE.BufferGeometry()).setFromPoints(points), gridMaterial));
    }
    for (let longitude = 0; longitude < 12; longitude++) {
      const points = [];
      const azimuth = longitude / 12 * Math.PI;
      for (let j = 0; j < 96; j++) {
        const a = j / 96 * Math.PI * 2;
        points.push(new THREE.Vector3(Math.sin(a) * Math.cos(azimuth) * gridRadius, Math.cos(a) * gridRadius, Math.sin(a) * Math.sin(azimuth) * gridRadius));
      }
      globe.add(new THREE.LineLoop(own(new THREE.BufferGeometry()).setFromPoints(points), gridMaterial));
    }
    globe.rotation.set(0.14, 0.28, -0.34);

    /* An inexpensive Fresnel shell replaces a full-screen multi-pass bloom chain. */
    const atmosphere = own(new THREE.ShaderMaterial({
      uniforms: { uColor: { value: accent.clone() }, uPulse: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = -viewPosition.xyz;
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uPulse;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float facing = abs(dot(normalize(vNormal), normalize(vView)));
          float rim = pow(1.0 - facing, 3.3);
          float strength = rim * (0.63 + uPulse * 0.22);
          gl_FragColor = vec4(uColor, strength);
        }
      `,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    const shell = new THREE.Mesh(own(new THREE.SphereGeometry(1.17, 48, 36)), atmosphere);
    globe.add(shell);

    function radialTexture() {
      const image = document.createElement('canvas');
      image.width = image.height = 128;
      const ctx = image.getContext('2d');
      if (!ctx) throw new Error('Canvas2D is unavailable');
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.07, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.22, 'rgba(255,255,255,0.24)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.055)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      const texture = own(new THREE.CanvasTexture(image));
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }
    const glowTexture = radialTexture();
    const aura = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTexture, color: 0x80b85d, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    aura.scale.set(7.5, 7.5, 1);
    aura.position.z = -2;
    root.add(aura);

    const markCanvas = document.createElement('canvas');
    markCanvas.width = 256;
    markCanvas.height = 128;
    const markContext = markCanvas.getContext('2d');
    if (markContext) {
      markContext.font = '500 106px system-ui, sans-serif';
      markContext.fillStyle = '#d3ffc1';
      markContext.textAlign = 'center';
      markContext.textBaseline = 'middle';
      markContext.fillText('G.', 119, 61);
      const markTexture = own(new THREE.CanvasTexture(markCanvas));
      markTexture.colorSpace = THREE.SRGBColorSpace;
      const mark = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: markTexture, transparent: true, opacity: 0.31, depthWrite: false, toneMapped: false })));
      mark.scale.set(0.98, 0.49, 1);
      mark.position.set(0, -0.02, 1.19);
      root.add(mark);
    }

    const orbitObjects = [];
    function createRing(radius, euler, color, phase, speed, primary = false) {
      const group = new THREE.Group();
      group.rotation.set(...euler);
      root.add(group);
      const points = [];
      for (let i = 0; i < 256; i++) {
        const a = i / 256 * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
      }
      const lineMaterial = own(new THREE.LineBasicMaterial({ color, transparent: true, opacity: primary ? 0.53 : 0.29, depthWrite: false }));
      group.add(new THREE.LineLoop(own(new THREE.BufferGeometry()).setFromPoints(points), lineMaterial));
      if (primary) {
        const rim = own(new THREE.TorusGeometry(radius + 0.065, 0.0035, 4, 256));
        group.add(new THREE.Mesh(rim, own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.17, depthWrite: false }))));
        const ticks = [];
        for (let j = 0; j < 100; j++) {
          const a = j / 100 * Math.PI * 2;
          const end = radius + (j % 5 === 0 ? 0.16 : 0.105);
          ticks.push(Math.cos(a) * (radius + 0.075), Math.sin(a) * (radius + 0.075), 0);
          ticks.push(Math.cos(a) * end, Math.sin(a) * end, 0);
        }
        const tickGeometry = own(new THREE.BufferGeometry());
        tickGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
        group.add(new THREE.LineSegments(tickGeometry, own(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.19, depthWrite: false }))));
      }
      const satellite = new THREE.Group();
      const ballMaterial = own(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      const ball = new THREE.Mesh(own(new THREE.SphereGeometry(primary ? 0.055 : 0.042, 16, 12)), ballMaterial);
      satellite.add(ball);
      const glowMaterial = own(new THREE.SpriteMaterial({ map: glowTexture, color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.83, depthWrite: false, toneMapped: false }));
      const glow = new THREE.Sprite(glowMaterial);
      glow.scale.set(0.73, 0.73, 1);
      satellite.add(glow);
      group.add(satellite);
      const trailGeometry = own(new THREE.BufferGeometry());
      const trailPositions = new Float32Array(36 * 3);
      const trailColors = new Float32Array(36 * 3);
      const trailColor = new THREE.Color(color);
      for (let j = 0; j < 36; j++) {
        const attenuation = (1 - j / 36) * 0.65;
        trailColors[j * 3] = trailColor.r * attenuation;
        trailColors[j * 3 + 1] = trailColor.g * attenuation;
        trailColors[j * 3 + 2] = trailColor.b * attenuation;
      }
      trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
      group.add(new THREE.Points(trailGeometry, own(new THREE.PointsMaterial({ size: 0.022, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))));
      orbitObjects.push({ radius, phase, speed, satellite, trailGeometry, trailPositions, lineMaterial, primary, ballMaterial, glowMaterial });
    }
    createRing(2.46, [0.98, 0.12, -0.47], 0xc3ff86, 0.96, 0.105, true);
    createRing(1.85, [0.17, 1.12, -0.25], 0x80c9b3, 3.95, -0.15);
    createRing(2.22, [1.13, -0.42, 0.78], 0xd5a182, 2.3, 0.08);

    /* Deterministic particles make visual snapshots reproducible. */
    let seed = 0x57454147;
    function random() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    const starCount = compact() ? 150 : 360;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starPhases = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (random() - 0.5) * 9.3;
      starPositions[i * 3 + 1] = (random() - 0.5) * 6.6;
      starPositions[i * 3 + 2] = -1.8 - random() * 5;
      starSizes[i] = random() * 1.9 + 0.65;
      starPhases[i] = random() * 6.28318;
    }
    const starsGeometry = own(new THREE.BufferGeometry());
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    starsGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
    const starsMaterial = own(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vAlpha = 0.16 + 0.14 * sin(aPhase + uTime * 0.42);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float distanceToCenter = length(gl_PointCoord - vec2(0.5));
          float alpha = (1.0 - smoothstep(0.08, 0.49, distanceToCenter)) * vAlpha;
          gl_FragColor = vec4(0.76, 0.91, 0.64, alpha);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    }));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    const abort = new AbortController();
    scope.defer(() => abort.abort());
    const signal = abort.signal;
    const pointer = new THREE.Vector2();
    const cameraTarget = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const spin = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let time = 0;
    let burst = 0;
    let baseDistance = 8.9;
    let lastFrame = 0;
    let previousTime = 0;
    let userPaused = false;
    let visible = true;
    let contextAvailable = true;
    let scrollProgress = 0;
    let drag = null;
    let loopActive = false;
    let renderedFrames = 0;
    const damp = (current, target, lambda, delta) => THREE.MathUtils.damp(current, target, lambda, delta);

    function updateMotionButton() {
      const paused = userPaused || reducedMotion.matches;
      motionButton.disabled = reducedMotion.matches || !contextAvailable;
      motionButton.setAttribute('aria-pressed', String(paused));
      motionButton.setAttribute('aria-label', reducedMotion.matches ? '已遵循系统减少动态效果设置' : paused ? '播放场景动画' : '暂停场景动画');
      motionButton.querySelector('span').textContent = paused ? '静态' : '动态';
      motionButton.querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
      stage.dataset.motion = paused ? 'paused' : 'playing';
    }
    function updateScene(delta) {
      accent.lerp(targetAccent, 1 - Math.exp(-delta * 4));
      gridMaterial.color.copy(accent);
      atmosphere.uniforms.uColor.value.copy(accent);
      atmosphere.uniforms.uPulse.value = burst;
      keyLight.color.copy(accent).lerp(neutralLightColor, 0.48);
      for (const orbit of orbitObjects) {
        const angle = orbit.phase + time * orbit.speed;
        orbit.satellite.position.set(Math.cos(angle) * orbit.radius, Math.sin(angle) * orbit.radius, 0);
        for (let j = 0; j < 36; j++) {
          const trailingAngle = angle - j * 0.008 * Math.sign(orbit.speed);
          orbit.trailPositions[j * 3] = Math.cos(trailingAngle) * orbit.radius;
          orbit.trailPositions[j * 3 + 1] = Math.sin(trailingAngle) * orbit.radius;
          orbit.trailPositions[j * 3 + 2] = 0;
        }
        orbit.trailGeometry.attributes.position.needsUpdate = true;
        if (orbit.primary) {
          orbit.lineMaterial.color.copy(accent);
          orbit.ballMaterial.color.copy(accent);
          orbit.glowMaterial.color.copy(accent);
        }
      }
      spin.x = damp(spin.x, spin.targetX, 5, delta);
      spin.y = damp(spin.y, spin.targetY, 5, delta);
      root.rotation.set(spin.x + scrollProgress * 0.11, spin.y + scrollProgress * 0.42, -0.025);
      globe.rotation.y = 0.28 + time * 0.035;
      globe.scale.setScalar(1 + burst * 0.025);
      cameraTarget.set(pointer.x * 0.22, -pointer.y * 0.16, baseDistance + scrollProgress * 0.65);
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 4));
      camera.lookAt(0, 0.1, 0);
      stars.rotation.z = time * 0.0015;
      starsMaterial.uniforms.uTime.value = time;
      burst = damp(burst, 0, 2.8, delta);
    }
    function guarded(callback) {
      return (...args) => {
        if (disposed) return;
        try { return callback(...args); }
        catch (error) {
          dispose();
          showFallback('场景更新失败，图形资源已释放。');
          console.warn('[喵连 scene] Update failed:', String(error));
        }
      };
    }
    function listen(target, type, callback, options) {
      target.addEventListener(type, guarded(callback), options);
    }
    function renderStill() {
      if (disposed || !contextAvailable) return;
      accent.copy(targetAccent);
      updateScene(1);
      renderer.render(scene, camera);
      stage.dataset.renderedFrames = String(++renderedFrames);
    }
    function frame(now) {
      if (disposed || !contextAvailable) return;
      try {
      const interval = compact() ? 1000 / 30 : 1000 / 50;
      if (now - lastFrame < interval - 1) return;
      const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.08) : 1 / 50;
      previousTime = now;
      lastFrame = now;
      time += delta;
      updateScene(delta);
      renderer.render(scene, camera);
      stage.dataset.renderedFrames = String(++renderedFrames);
      } catch (error) {
        dispose();
        showFallback('场景渲染失败，图形资源已释放。');
        console.warn('[喵连 scene] Render failed:', String(error));
      }
    }
    function syncLoop() {
      if (disposed) return;
      const shouldRun = visible && !document.hidden && !userPaused && !reducedMotion.matches && contextAvailable;
      if (shouldRun !== loopActive) {
        renderer.setAnimationLoop(shouldRun ? frame : null);
        loopActive = shouldRun;
        previousTime = 0;
        lastFrame = 0;
      }
      updateMotionButton();
    }
    function resize() {
      if (disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, compact() ? 1.25 : 1.5);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      starsMaterial.uniforms.uPixelRatio.value = ratio;
      camera.aspect = width / height;
      baseDistance = Math.max(8.7, 2.72 / (Math.tan(THREE.MathUtils.degToRad(39) / 2) * camera.aspect));
      camera.position.set(0, 0, baseDistance);
      camera.updateProjectionMatrix();
      renderStill();
    }
    const resizeObserver = new ResizeObserver(guarded(resize));
    scope.defer(() => resizeObserver.disconnect());
    resizeObserver.observe(mount);
    const intersectionObserver = new IntersectionObserver(guarded((entries) => {
      visible = entries[0].isIntersecting;
      syncLoop();
    }), { threshold: 0, rootMargin: '60px' });
    scope.defer(() => intersectionObserver.disconnect());
    intersectionObserver.observe(stage);
    listen(document, 'visibilitychange', syncLoop, { signal });
    listen(reducedMotion, 'change', () => { renderStill(); syncLoop(); }, { signal });
    listen(motionButton, 'click', () => {
      userPaused = !userPaused;
      renderStill();
      syncLoop();
    }, { signal });

    listen(window, 'scroll', () => {
      if (!visible || reducedMotion.matches) return;
      const rect = stage.getBoundingClientRect();
      scrollProgress = Math.max(0, Math.min(1, -rect.top / window.innerHeight));
    }, { passive: true, signal });
    listen(canvas, 'pointerdown', (event) => {
      if (event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
      if (event.pointerType === 'mouse') canvas.setPointerCapture(event.pointerId);
    }, { signal });
    listen(canvas, 'pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1);
      if (drag && drag.id === event.pointerId) {
        const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
        if (distance > 5) drag.moved = true;
        if (event.pointerType !== 'touch' || Math.abs(event.clientX - drag.x) > Math.abs(event.clientY - drag.y)) {
          spin.targetY += (event.clientX - drag.lastX) * 0.006;
          spin.targetX = THREE.MathUtils.clamp(spin.targetX + (event.clientY - drag.lastY) * 0.004, -0.6, 0.6);
        }
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
      }
      if (reducedMotion.matches || userPaused) renderStill();
    }, { passive: true, signal });
    listen(canvas, 'pointerleave', () => { pointer.set(0, 0); }, { signal });
    listen(canvas, 'pointerup', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.moved) {
        const rect = canvas.getBoundingClientRect();
        raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
        if (raycaster.intersectObject(core).length) {
          const keys = ['codex', 'claude', 'pi'];
          const index = keys.indexOf(stage.dataset.activeAgent);
          const next = keys[(index + 1) % keys.length];
          document.querySelector(`[data-orbit-agent="${next}"]`).click();
        }
      }
      drag = null;
    }, { signal });
    listen(canvas, 'pointercancel', () => { drag = null; }, { signal });
    listen(window, 'weagent:agent-change', (event) => {
      const key = event.detail.key;
      if (!Object.hasOwn(palette, key)) return;
      targetAccent.setHex(palette[key]);
      burst = 1;
      if (userPaused || reducedMotion.matches) renderStill();
    }, { signal });

    listen(canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      contextAvailable = false;
      syncLoop();
      showFallback('图形上下文已丢失，正在等待浏览器恢复。');
    }, { signal });
    listen(canvas, 'webglcontextrestored', () => {
      contextAvailable = true;
      renderStill();
      stage.classList.add('has-webgl');
      stage.dataset.renderer = 'three';
      status.textContent = 'DRAG TO ROTATE · CLICK TO SWITCH';
      status.title = '拖动场景旋转，点击中心球体或 Agent 标签切换。';
      syncLoop();
    }, { signal });

    listen(window, 'pagehide', (event) => {
      if (!event.persisted) dispose();
      else { renderer.setAnimationLoop(null); loopActive = false; }
    }, { signal });
    listen(window, 'pageshow', syncLoop, { signal });

    resize();
    stage.classList.add('has-webgl');
    stage.dataset.renderer = 'three';
    stage.dataset.threeRevision = THREE.REVISION;
    status.textContent = 'DRAG TO ROTATE · CLICK TO SWITCH';
    status.title = '拖动场景旋转，点击中心球体或 Agent 标签切换。';
    syncLoop();
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
