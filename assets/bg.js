/* =============================================================================
   Fundo animado (Three.js) · rede de nós conectados
   Intensidade equilibrada. Adapta ao tema, respeita prefers-reduced-motion
   e pausa quando a aba fica oculta. Puramente decorativo (pointer-events:none).
   ============================================================================= */
import * as THREE from './three.module.min.js';

const CANVAS = document.getElementById('bg');
if (CANVAS) initBackground(CANVAS);

function initBackground(canvas) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- paleta por tema (verde-água + azul); o alvo de mescla é a cor do fundo da página
  const THEMES = {
    dark:  { node: 0x3fe9cf, node2: 0x4b93d4, line: 0x2fbfd8, mix: 0x0b1017, additive: true,  nodeOpacity: 0.95, lineOpacity: 0.55, size: 0.17 },
    light: { node: 0x0f8f87, node2: 0x15568a, line: 0x1792a0, mix: 0xeef2f6, additive: false, nodeOpacity: 0.85, lineOpacity: 0.7,  size: 0.13 },
  };

  function currentMode() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  let theme = THEMES[currentMode()];

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const group = new THREE.Group();
  group.rotation.x = -0.32;          // leve inclinação isométrica
  scene.add(group);

  // --- nós
  const COUNT = 64;
  const BOX = { x: 9.2, y: 5.2, z: 5.0 };
  const MAXDIST = 4.3;
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const nodeCol = new Float32Array(COUNT * 3);
  const cA = new THREE.Color(theme.node), cB = new THREE.Color(theme.node2);
  for (let i = 0; i < COUNT; i++) {
    pos[i*3]   = (Math.random()*2-1)*BOX.x;
    pos[i*3+1] = (Math.random()*2-1)*BOX.y;
    pos[i*3+2] = (Math.random()*2-1)*BOX.z;
    const sp = reduce ? 0 : 0.012;
    vel[i*3]   = (Math.random()*2-1)*sp;
    vel[i*3+1] = (Math.random()*2-1)*sp;
    vel[i*3+2] = (Math.random()*2-1)*sp;
    const c = Math.random() < 0.5 ? cA : cB;
    nodeCol[i*3] = c.r; nodeCol[i*3+1] = c.g; nodeCol[i*3+2] = c.b;
  }

  // sprite suave para os pontos
  const sprite = makeDotTexture();
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  ptsGeo.setAttribute('color', new THREE.BufferAttribute(nodeCol, 3));
  const ptsMat = new THREE.PointsMaterial({
    size: theme.size, map: sprite, vertexColors: true, transparent: true,
    opacity: theme.nodeOpacity, depthWrite: false, sizeAttenuation: true,
    blending: theme.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(ptsGeo, ptsMat);
  group.add(points);

  // --- linhas (constelação): buffer pré-alocado
  const MAXSEG = 1600;
  const linePos = new Float32Array(MAXSEG * 2 * 3);
  const lineCol = new Float32Array(MAXSEG * 2 * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: theme.lineOpacity, depthWrite: false,
    blending: theme.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  group.add(lines);

  let lineBase = new THREE.Color(theme.line);
  let mixTarget = new THREE.Color(theme.mix);

  function rebuildLines() {
    let seg = 0;
    for (let i = 0; i < COUNT && seg < MAXSEG; i++) {
      const ax = pos[i*3], ay = pos[i*3+1], az = pos[i*3+2];
      for (let j = i + 1; j < COUNT && seg < MAXSEG; j++) {
        const dx = ax - pos[j*3], dy = ay - pos[j*3+1], dz = az - pos[j*3+2];
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d > MAXDIST) continue;
        const s = 1 - d / MAXDIST;           // 0 (longe) .. 1 (perto)
        // cor = mescla(fundo, corDaLinha, s)  -> some suavemente ao enfraquecer
        const r = mixTarget.r + (lineBase.r - mixTarget.r) * s;
        const g = mixTarget.g + (lineBase.g - mixTarget.g) * s;
        const b = mixTarget.b + (lineBase.b - mixTarget.b) * s;
        const o = seg * 6;
        linePos[o]   = ax; linePos[o+1] = ay; linePos[o+2] = az;
        linePos[o+3] = pos[j*3]; linePos[o+4] = pos[j*3+1]; linePos[o+5] = pos[j*3+2];
        lineCol[o]=r; lineCol[o+1]=g; lineCol[o+2]=b;
        lineCol[o+3]=r; lineCol[o+4]=g; lineCol[o+5]=b;
        seg++;
      }
    }
    lineGeo.setDrawRange(0, seg * 2);
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;
  }

  // --- parallax do mouse
  const target = { x: 0, y: 0 };
  const curr = { x: 0, y: 0 };
  if (!reduce) {
    window.addEventListener('pointermove', (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function step() {
    if (!reduce) {
      for (let i = 0; i < COUNT; i++) {
        pos[i*3]   += vel[i*3];
        pos[i*3+1] += vel[i*3+1];
        pos[i*3+2] += vel[i*3+2];
        if (pos[i*3] >  BOX.x || pos[i*3] < -BOX.x) vel[i*3]   *= -1;
        if (pos[i*3+1] >  BOX.y || pos[i*3+1] < -BOX.y) vel[i*3+1] *= -1;
        if (pos[i*3+2] >  BOX.z || pos[i*3+2] < -BOX.z) vel[i*3+2] *= -1;
      }
      ptsGeo.attributes.position.needsUpdate = true;
      group.rotation.y += 0.0009;
      curr.x += (target.x - curr.x) * 0.04;
      curr.y += (target.y - curr.y) * 0.04;
      camera.position.x = curr.x * 1.6;
      camera.position.y = -curr.y * 1.0;
      camera.lookAt(0, 0, 0);
    }
    rebuildLines();
    renderer.render(scene, camera);
  }

  let running = true;
  function loop() {
    if (!running) return;
    step();
    if (!reduce) requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; }
    else if (!reduce) { running = true; loop(); }
  });

  // primeira renderização (também cobre o caso reduce = estático)
  step();
  if (!reduce) { loop(); }

  // --- troca de tema em tempo real
  function applyTheme(mode) {
    theme = THEMES[mode] || THEMES.dark;
    const a = new THREE.Color(theme.node), b = new THREE.Color(theme.node2);
    for (let i = 0; i < COUNT; i++) {
      const c = (nodeCol[i*3] === cA.r && nodeCol[i*3+1] === cA.g) ? a : (Math.random() < 0.5 ? a : b);
      nodeCol[i*3] = c.r; nodeCol[i*3+1] = c.g; nodeCol[i*3+2] = c.b;
    }
    ptsGeo.attributes.color.needsUpdate = true;
    ptsMat.opacity = theme.nodeOpacity; ptsMat.size = theme.size;
    ptsMat.blending = theme.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    ptsMat.needsUpdate = true;
    lineMat.opacity = theme.lineOpacity;
    lineMat.blending = theme.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    lineMat.needsUpdate = true;
    lineBase = new THREE.Color(theme.line);
    mixTarget = new THREE.Color(theme.mix);
    if (reduce) step();
  }
  window.__bgApplyTheme = applyTheme;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.getAttribute('data-theme')) applyTheme(currentMode());
  });
}

function makeDotTexture() {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.Texture(cv);
  tex.needsUpdate = true;
  return tex;
}
