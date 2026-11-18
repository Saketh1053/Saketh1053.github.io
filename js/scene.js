import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

const webglOK = supportsWebGL();
if (!webglOK) document.documentElement.classList.add('no-webgl');

// ---------------------------------------------------------------------------
// Skills scene: a rotating 3D tag cloud of readable skill labels (rendered as
// canvas-texture sprites, so names are visible at a glance instead of hidden
// behind hoverable dots).
// ---------------------------------------------------------------------------

const SKILLS = [
  { label: 'Python', color: '#52f2c8' },
  { label: 'SQL', color: '#7c8cff' },
  { label: 'R', color: '#ffb547' },
  { label: 'JavaScript', color: '#52f2c8' },
  { label: 'TypeScript', color: '#7c8cff' },
  { label: 'React', color: '#52f2c8' },
  { label: 'Node.js', color: '#7c8cff' },
  { label: 'Django', color: '#ffb547' },
  { label: 'FastAPI', color: '#52f2c8' },
  { label: 'Flask', color: '#7c8cff' },
  { label: 'PostgreSQL', color: '#52f2c8' },
  { label: 'MySQL', color: '#7c8cff' },
  { label: 'MongoDB', color: '#ffb547' },
  { label: 'AWS', color: '#52f2c8' },
  { label: 'Docker', color: '#7c8cff' },
  { label: 'Kubernetes', color: '#ffb547' },
  { label: 'LLMs', color: '#52f2c8' },
  { label: 'RAG', color: '#7c8cff' },
];

function makeLabelSprite(text, colorHex) {
  const fontSize = 42;
  const scaleFactor = 2;
  const font = `700 ${fontSize * scaleFactor}px 'JetBrains Mono', monospace`;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textWidth = measure.measureText(text).width;

  const paddingX = 18 * scaleFactor;
  const paddingY = 12 * scaleFactor;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(textWidth + paddingX * 2);
  canvas.height = Math.ceil(fontSize * scaleFactor + paddingY * 2);

  const ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colorHex;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const worldHeight = 0.6;
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  sprite.userData.baseScale = sprite.scale.clone();
  return sprite;
}

function initStackScene() {
  const container = document.getElementById('stackCanvasWrap');
  if (!container || !webglOK) return;

  let width = container.clientWidth;
  let height = container.clientHeight;

  const scene = new THREE.Scene();
  // FOV is widened (not the camera pulled back) so a pole-aligned label, at
  // full sprite size, stays inside the vertical frustum at every rotation --
  // a label near the top/bottom of the sphere was getting clipped by the
  // renderer's own viewport edge otherwise, which no amount of DOM
  // overflow/padding can fix since it's a 3D camera bound, not a CSS one.
  // Camera distance stays at the original value so the cloud doesn't shrink.
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const sphereRadius = 2.7;
  const sprites = SKILLS.map((skill, i) => {
    const count = SKILLS.length;
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const sprite = makeLabelSprite(skill.label, skill.color);
    sprite.position.set(Math.cos(theta) * r * sphereRadius, y * sphereRadius, Math.sin(theta) * r * sphereRadius);
    group.add(sprite);
    return sprite;
  });

  // Labels on the near and far side of the sphere can project to the same
  // screen spot and visually collide, since a billboarded sprite has no
  // depth cue of its own. Shrinking and fading each label by its actual
  // distance from the camera each frame pushes far-side labels visually
  // behind near ones instead of competing for the same pixels.
  const depthNear = camera.position.z - sphereRadius;
  const depthFar = camera.position.z + sphereRadius;
  const worldPos = new THREE.Vector3();

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2(-10, -10);
  let hovered = null;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velY = prefersReducedMotion ? 0 : 0.0016;
  let velX = 0;

  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();

    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      velY = dx * 0.004;
      velX = dy * 0.004;
      group.rotation.y += velY;
      group.rotation.x += velX;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNDC.set(nx, ny);
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(sprites);
    hovered = hits.length ? hits[0].object : null;
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; });

  const resize = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container);

  const animate = () => {
    requestAnimationFrame(animate);
    if (document.hidden) return;
    if (!dragging && !prefersReducedMotion) {
      group.rotation.y += velY;
      group.rotation.x += velX * 0.2;
      velY += (0.0016 - velY) * 0.01;
      velX *= 0.98;
    }
    sprites.forEach(sprite => {
      sprite.getWorldPosition(worldPos);
      const depthT = Math.max(0, Math.min(1, (worldPos.distanceTo(camera.position) - depthNear) / (depthFar - depthNear)));
      const isHovered = sprite === hovered;
      // Only ever shrink far-side labels back, never enlarge near-side ones
      // past their base size -- a near-side label is already closest to the
      // frustum's vertical edge, so enlarging it is exactly what clips it.
      const depthScale = 1 - depthT * 0.4;
      const target = depthScale * (isHovered ? 1.35 : 1);
      const base = sprite.userData.baseScale;
      sprite.scale.x += (base.x * target - sprite.scale.x) * 0.2;
      sprite.scale.y += (base.y * target - sprite.scale.y) * 0.2;

      const opacityTarget = isHovered ? 1 : 1 - depthT * 0.75; // far side fades back instead of competing for the same pixels
      sprite.material.opacity += (opacityTarget - sprite.material.opacity) * 0.2;
    });
    renderer.render(scene, camera);
  };
  animate();
}

try { initStackScene(); } catch (e) { console.warn('Skills tag cloud failed to initialize', e); }
