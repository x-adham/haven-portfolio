/* =========================================================
   HAVEN — "The Focus Room" 3D hero
   Three.js + UnrealBloom. A molten-gold focus core sits inside
   a live pomodoro ring; orbiting lights represent members who
   are online right now (from Discord's public invite counts).
   Hovering "Join" pulls everyone in toward the core.
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const INVITE_CODE = 'rABxgQV8dq';
const root = document.documentElement;
const section = document.getElementById('hero3d');
const canvas = document.getElementById('h3dCanvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 900px)').matches;

/* ---------------- Preloader ---------------- */
const preCount = document.getElementById('preCount');
const preBar = document.getElementById('preBar');
const pre = { v: 0, target: 12, done: false };
function setPre(t) { pre.target = Math.max(pre.target, t); }
function finishLoading() {
  if (pre.done) return;
  pre.done = true;
  clearTimeout(window.__h3dFailsafe);
  root.classList.remove('is-loading');
  root.classList.add('is-loaded');
  setTimeout(() => root.classList.add('is-done'), 1600);
}
(function preTick() {
  if (pre.done) return;
  // creep toward target, never stall completely below it
  pre.v += Math.max((pre.target - pre.v) * 0.08, pre.v < pre.target ? 0.25 : 0);
  if (pre.target < 100) pre.v = Math.min(pre.v, pre.target);
  const v = Math.min(100, Math.round(pre.v));
  if (preCount) preCount.textContent = v;
  if (preBar) preBar.style.transform = `scaleX(${v / 100})`;
  if (v >= 100) { setTimeout(finishLoading, 250); return; }
  requestAnimationFrame(preTick);
})();
if (root.classList.contains('is-loaded')) pre.done = true; // failsafe already fired
document.fonts?.ready.then(() => setPre(45));

/* ---------------- Live Discord counts ---------------- */
const elOnline = document.getElementById('h3dOnline');
const elMembers = document.getElementById('h3dMembers');
let onlineTarget = 48; // visual default until live data arrives
(async () => {
  const key = 'haven-invite-counts-v1';
  let data = null;
  try {
    const c = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (c && Date.now() - c.t < 5 * 60e3) data = c;
  } catch { /* ignore */ }
  if (!data) {
    try {
      const res = await fetch(`https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`);
      if (res.ok) {
        const j = await res.json();
        data = { online: j.approximate_presence_count, members: j.approximate_member_count, t: Date.now() };
        sessionStorage.setItem(key, JSON.stringify(data));
      }
    } catch { /* offline / blocked — keep defaults */ }
  }
  if (data && typeof data.online === 'number' && data.online > 0) {
    onlineTarget = data.online;
    if (elOnline) elOnline.parentElement.innerHTML = `<b id="h3dOnline">${data.online.toLocaleString()}</b> members online in Haven now`;
  } else if (elOnline) {
    elOnline.parentElement.innerHTML = `<b id="h3dOnline">Open</b> study rooms, 24/7`;
  }
  if (data && typeof data.members === 'number' && elMembers) {
    elMembers.textContent = data.members.toLocaleString();
  }
})();

/* ---------------- Pomodoro clock (25 / 5, aligned to :00 and :30) ---------------- */
const elPhase = document.getElementById('h3dPhase');
const elTime = document.getElementById('h3dTime');
const elSub = document.getElementById('h3dSub');
const pomo = { progress: 0, isBreak: false };
function updatePomodoro() {
  const now = new Date();
  const secInCycle = (now.getMinutes() % 30) * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
  const focusLen = 25 * 60, breakLen = 5 * 60;
  const isBreak = secInCycle >= focusLen;
  const elapsed = isBreak ? secInCycle - focusLen : secInCycle;
  const len = isBreak ? breakLen : focusLen;
  const left = Math.max(0, Math.ceil(len - elapsed));
  pomo.progress = elapsed / len;
  if (isBreak !== pomo.isBreak || !elPhase.dataset.init) {
    pomo.isBreak = isBreak;
    elPhase.dataset.init = '1';
    elPhase.textContent = isBreak ? 'Break' : 'Focus sprint';
    elSub.textContent = isBreak ? 'Next sprint soon' : 'Pomodoro · 25 / 5';
    section.classList.toggle('is-break', isBreak);
  }
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const txt = `${mm}:${ss}`;
  if (elTime.textContent !== txt) elTime.textContent = txt;
}
updatePomodoro();
setInterval(updatePomodoro, 250);

/* ---------------- WebGL guard ---------------- */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
if (!webglOK()) {
  root.classList.add('h3d-nogl');
  setPre(100);
} else {
  try { initScene(); } catch (err) {
    console.warn('[hero3d] falling back to static hero', err);
    root.classList.add('h3d-nogl');
    setPre(100);
  }
}

/* =========================================================
   SCENE
   ========================================================= */
function initScene() {
  setPre(60);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x060504, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060504, 0.045);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const CAM_Z = 10;
  camera.position.set(0, 0.35, 16);

  const world = new THREE.Group();   // layout (position/scale)
  const rig = new THREE.Group();     // mouse tilt
  world.add(rig);
  scene.add(world);

  /* ---------- shared GLSL noise ---------- */
  const NOISE = /* glsl */`
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  const U = {
    uTime: { value: 0 },
    uPull: { value: 0 },
    uIntro: { value: 0 },
    uBreak: { value: 0 },
  };

  /* ---------- 1. Focus core (molten gold sun) ---------- */
  const coreMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vN; varying vec3 vView; varying vec3 vPos;
      ${NOISE}
      void main(){
        vec3 p = position;
        float d = snoise(p * 1.7 + vec3(0.0, uTime * 0.28, 0.0)) * 0.045;
        p += normal * d;
        vPos = position;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uPull; uniform float uBreak;
      varying vec3 vN; varying vec3 vView; varying vec3 vPos;
      ${NOISE}
      void main(){
        vec3 q = vPos * 2.0;
        float n  = snoise(q + vec3(0.0, uTime * 0.22, uTime * 0.08));
        n += 0.5  * snoise(q * 2.3 - vec3(uTime * 0.31, 0.0, 0.0));
        n += 0.25 * snoise(q * 5.1 + uTime * 0.45);
        float cells = smoothstep(0.15, 0.95, abs(snoise(q * 3.4 + uTime * 0.12)));
        float fres = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 2.4);

        vec3 deep = vec3(0.78, 0.26, 0.03);
        vec3 gold = vec3(1.00, 0.62, 0.18);
        vec3 hot  = vec3(1.00, 0.95, 0.84);
        vec3 calm = vec3(0.55, 0.95, 0.75); // break tint
        vec3 col = mix(deep, gold, smoothstep(-0.6, 0.4, n));
        col = mix(col, hot, smoothstep(0.55, 1.2, n) * 0.8);
        col *= 0.82 + 0.35 * (1.0 - cells);
        col = mix(col, mix(col, calm, 0.35), uBreak);
        col += hot * fres * (0.9 + uPull * 0.8);
        col *= 0.72 + uPull * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, isSmall ? 96 : 160, isSmall ? 64 : 120), coreMat);
  core.scale.setScalar(0.92);
  rig.add(core);

  // halo
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,236,190,1)');
    gr.addColorStop(0.18, 'rgba(255,196,96,.55)');
    gr.addColorStop(0.45, 'rgba(212,140,40,.14)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, fog: false,
  }));
  halo.scale.setScalar(5.2);
  rig.add(halo);

  /* ---------- 2. Pomodoro ring ---------- */
  const R = 2.45;
  const ring = new THREE.Group();
  ring.rotation.set(-1.08, 0.0, 0.2);
  rig.add(ring);

  // faint full track
  ring.add(new THREE.Mesh(
    new THREE.RingGeometry(R - 0.004, R + 0.004, 256),
    new THREE.MeshBasicMaterial({ color: 0xf3e5ab, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  ));

  // progress arc (angle-masked shader)
  const arcU = { uProgress: { value: 0 }, uBreak: U.uBreak, uTime: U.uTime };
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(R - 0.018, R + 0.018, 512, 1),
    new THREE.ShaderMaterial({
      uniforms: arcU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uProgress; uniform float uBreak; uniform float uTime; varying vec2 vP;
        void main(){
          float a = atan(vP.x, vP.y);                 // 0 at 12 o'clock, clockwise
          float f = mod(a, 6.2831853) / 6.2831853;
          if (f > uProgress) discard;
          float tail = smoothstep(0.0, 0.6, f / max(uProgress, 0.0001));
          vec3 gold = vec3(1.0, 0.78, 0.36);
          vec3 calm = vec3(0.5, 1.0, 0.72);
          vec3 c = mix(gold, calm, uBreak) * (0.5 + 1.6 * tail);
          gl_FragColor = vec4(c, 0.35 + 0.65 * tail);
        }`,
    })
  );
  ring.add(arc);

  // 60 minute ticks (instanced), lit as the sprint progresses
  const TICKS = 60;
  const tickGeo = new THREE.BoxGeometry(0.022, 1, 0.022);
  const ticks = new THREE.InstancedMesh(tickGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }), TICKS);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * Math.PI * 2;
    const major = i % 5 === 0;
    const len = major ? 0.26 : 0.12;
    const r = R + 0.16 + len / 2;
    pos.set(Math.sin(a) * r, Math.cos(a) * r, 0);
    q.setFromAxisAngle(zAxis, -a);
    sc.set(major ? 1.4 : 1, len, major ? 1.4 : 1);
    ticks.setMatrixAt(i, m4.compose(pos, q, sc));
    ticks.setColorAt(i, new THREE.Color(0.2, 0.17, 0.1));
  }
  ring.add(ticks);
  const tickDim = new THREE.Color(0.22, 0.18, 0.11);
  const tickLitGold = new THREE.Color(1.7, 1.2, 0.5);
  const tickLitCalm = new THREE.Color(0.7, 1.6, 1.05);
  const tmpC = new THREE.Color();

  // glowing head that rides the arc
  const head = new THREE.Group();
  const headDot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.4) }));
  const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }));
  headGlow.scale.setScalar(0.9);
  head.add(headDot, headGlow);
  ring.add(head);

  // outer dotted ring, slow counter-rotation
  const dotsN = 220;
  const dotsPos = new Float32Array(dotsN * 3);
  for (let i = 0; i < dotsN; i++) {
    const a = (i / dotsN) * Math.PI * 2;
    dotsPos[i * 3] = Math.cos(a) * (R + 0.75);
    dotsPos[i * 3 + 1] = Math.sin(a) * (R + 0.75);
  }
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotsPos, 3));
  const dots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: 0xd4af37, size: 0.022, transparent: true, opacity: 0.45, depthWrite: false }));
  ring.add(dots);

  // faint orbit paths
  [[3.3, 0.55, 0.3], [3.9, -0.4, 1.4], [4.6, 0.2, 2.4]].forEach(([r, incl, node]) => {
    const pts = [];
    for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.07, depthWrite: false }));
    line.rotation.set(incl, node, 0);
    rig.add(line);
  });

  /* ---------- 3. Members (bright) + study dust (dim) ---------- */
  const MAX_MEMBERS = 700;
  const DUST = isSmall ? 1200 : 2800;
  const N = MAX_MEMBERS + DUST;
  const aRadius = new Float32Array(N), aIncl = new Float32Array(N), aNode = new Float32Array(N);
  const aPhase = new Float32Array(N), aSpeed = new Float32Array(N), aSize = new Float32Array(N);
  const aIndex = new Float32Array(N), aSeed = new Float32Array(N);
  const rand = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < N; i++) {
    const member = i < MAX_MEMBERS;
    aIndex[i] = member ? i : 1e6;
    aSeed[i] = Math.random();
    aPhase[i] = Math.random() * Math.PI * 2;
    aNode[i] = Math.random() * Math.PI * 2;
    if (member) {
      aRadius[i] = rand(1.55, 4.4);
      aIncl[i] = rand(-0.75, 0.75);
      aSpeed[i] = rand(0.05, 0.16) * (2.6 / aRadius[i]) * (Math.random() < 0.85 ? 1 : -1);
      aSize[i] = rand(1.6, 3.0);
    } else {
      aRadius[i] = 1.25 + Math.pow(Math.random(), 1.6) * 8.5;
      aIncl[i] = rand(-Math.PI, Math.PI);
      aSpeed[i] = rand(0.008, 0.04) * (Math.random() < 0.5 ? 1 : -1);
      aSize[i] = rand(0.6, 1.7);
    }
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  [['aRadius', aRadius], ['aIncl', aIncl], ['aNode', aNode], ['aPhase', aPhase], ['aSpeed', aSpeed], ['aSize', aSize], ['aIndex', aIndex], ['aSeed', aSeed]]
    .forEach(([k, v]) => pGeo.setAttribute(k, new THREE.BufferAttribute(v, 1)));
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

  const pU = { ...U, uMembers: { value: 0 }, uPR: { value: dpr } };
  const particles = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aRadius, aIncl, aNode, aPhase, aSpeed, aSize, aIndex, aSeed;
      uniform float uTime, uPull, uMembers, uPR, uIntro;
      varying float vMember; varying float vAlpha;
      void main(){
        float isM = step(aIndex, uMembers - 0.5);
        float pull = uPull * (isM > 0.5 ? 1.0 : 0.22);
        float r = aRadius * mix(1.0, mix(0.5, 0.78, aSeed), pull);
        r *= mix(2.2, 1.0, uIntro);                       // gather in on intro
        float a = aPhase + uTime * aSpeed * (1.0 + uPull * 2.2 * isM);
        vec3 p = vec3(cos(a) * r, 0.0, sin(a) * r);
        float ci = cos(aIncl), si = sin(aIncl);
        p = vec3(p.x, p.y * ci - p.z * si, p.y * si + p.z * ci);
        float cn = cos(aNode), sn = sin(aNode);
        p = vec3(p.x * cn + p.z * sn, p.y, -p.x * sn + p.z * cn);
        p.y += sin(uTime * 0.6 + aSeed * 31.0) * 0.05;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.6 + 0.4 * sin(uTime * (0.8 + aSeed * 2.4) + aSeed * 57.0);
        vMember = isM;
        vAlpha = tw * uIntro;
        float s = aSize * (isM > 0.5 ? 1.75 + uPull * 0.6 : 1.0);
        gl_PointSize = s * uPR * (30.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vMember; varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = pow(smoothstep(0.5, 0.0, d), 2.0);
        vec3 dust = vec3(1.0, 0.74, 0.40) * 0.55;
        vec3 mem  = vec3(1.0, 0.90, 0.72) * 2.4;
        vec3 c = mix(dust, mem, vMember);
        gl_FragColor = vec4(c * core, core * vAlpha);
      }`,
  }));
  rig.add(particles);

  /* ---------- Post-processing ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.55, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- Layout ---------- */
  function layout() {
    const w = section.clientWidth, h = section.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    const halfW = halfH * camera.aspect;
    if (camera.aspect >= 1.05) {
      // desktop: scene sits right of the copy
      world.position.set(halfW * 0.4, 0.05, 0);
      world.scale.setScalar(Math.min(1, (halfW * 0.62) / 3.6));
    } else {
      // portrait/mobile: scene sits above the copy
      world.position.set(0, halfH * 0.42, 0);
      world.scale.setScalar(Math.min(0.85, (halfW * 0.98) / 3.2));
    }
  }
  layout();
  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(layout); });

  /* ---------- Interaction ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let pullTarget = 0;
  const join = document.getElementById('h3dJoin');
  if (join) {
    join.addEventListener('pointerenter', () => { pullTarget = 1; });
    join.addEventListener('pointerleave', () => { pullTarget = 0; });
    join.addEventListener('focus', () => { pullTarget = 1; });
    join.addEventListener('blur', () => { pullTarget = 0; });
    join.addEventListener('touchstart', () => { pullTarget = 1; setTimeout(() => { pullTarget = 0; }, 1400); }, { passive: true });
  }

  /* ---------- Visibility (pause when off-screen) ---------- */
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(section);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });

  /* ---------- Loop ---------- */
  const clock = { t: 0 };
  let last = performance.now();
  let introStart = -1;
  let slowFrames = 0, perfChecked = 0;
  const timeScale = reduceMotion ? 0.15 : 1;
  const easeOut = (x) => 1 - Math.pow(1 - x, 4);

  function frame(now) {
    requestAnimationFrame(frame);
    const dtRaw = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!visible || document.hidden) return;

    // adaptive resolution: drop DPR if the device struggles
    if (perfChecked < 240) {
      perfChecked++;
      if (dtRaw > 1 / 38) slowFrames++;
      if (perfChecked === 240 && slowFrames > 90 && dpr > 1) {
        dpr = 1; renderer.setPixelRatio(dpr); pU.uPR.value = dpr; layout();
      }
    }

    const dt = dtRaw * timeScale;
    clock.t += dt;
    U.uTime.value = clock.t;

    // intro: camera glides in, particles gather
    if (introStart < 0 && root.classList.contains('is-loaded')) introStart = now;
    const ip = introStart < 0 ? 0 : Math.min((now - introStart) / (reduceMotion ? 10 : 3200), 1);
    const ie = easeOut(ip);
    U.uIntro.value = ie;
    core.scale.setScalar(0.92 * (0.35 + 0.65 * ie));
    halo.material.opacity = (0.45 + U.uPull.value * 0.2) * ie;

    // mouse
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    rig.rotation.y = mouse.x * 0.28 + Math.sin(clock.t * 0.12) * 0.06;
    rig.rotation.x = mouse.y * 0.14;
    camera.position.x = mouse.x * 0.35;
    camera.position.y = 0.35 - mouse.y * 0.2;
    camera.position.z = THREE.MathUtils.lerp(16, CAM_Z, ie) - U.uPull.value * 0.6;
    camera.lookAt(world.position.x * 0.15, world.position.y * 0.15, 0);

    // join-hover pull
    U.uPull.value += (pullTarget - U.uPull.value) * (pullTarget ? 0.06 : 0.035);
    bloom.strength = 0.8 + U.uPull.value * 0.3;

    // members count eases toward live value
    const memTarget = Math.min(MAX_MEMBERS, Math.max(12, onlineTarget)) * ie;
    pU.uMembers.value += (memTarget - pU.uMembers.value) * 0.03;

    // pomodoro ring
    U.uBreak.value += ((pomo.isBreak ? 1 : 0) - U.uBreak.value) * 0.05;
    arcU.uProgress.value = pomo.progress * ie;
    const lit = Math.floor(pomo.progress * TICKS);
    const litCol = pomo.isBreak ? tickLitCalm : tickLitGold;
    for (let i = 0; i < TICKS; i++) {
      if (i <= lit) {
        const pulse = i === lit ? 1.0 + 0.5 * Math.sin(clock.t * 4.0) : 0.75 + 0.25 * (i / Math.max(lit, 1));
        tmpC.copy(litCol).multiplyScalar(pulse * ie);
        ticks.setColorAt(i, tmpC);
      } else ticks.setColorAt(i, tickDim);
    }
    ticks.instanceColor.needsUpdate = true;
    const ha = arcU.uProgress.value * Math.PI * 2;
    head.position.set(Math.sin(ha) * R, Math.cos(ha) * R, 0);
    headDot.material.color.copy(pomo.isBreak ? tickLitCalm : tickLitGold).multiplyScalar(1.4);
    headGlow.scale.setScalar(0.8 + 0.15 * Math.sin(clock.t * 3.0));
    dots.rotation.z = -clock.t * 0.03;
    core.rotation.y = clock.t * 0.05;

    composer.render(dt);
  }

  // compile shaders before revealing
  setPre(85);
  renderer.compile(scene, camera);
  composer.render(0);
  requestAnimationFrame(() => {
    section.classList.add('is-ready');
    setPre(100);
    requestAnimationFrame(frame);
  });
}
