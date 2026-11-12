import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEG = Math.PI / 180;

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
// Shared pose-player: generic cross-fading loop through a list of named
// moves, each a pure function of its own elapsed time.
// ---------------------------------------------------------------------------

function lerpPose(a, b, t) {
  const out = {};
  for (const key in a) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

function createMovePlayer(moves, basePoseFn) {
  let moveIndex = 0;
  let moveElapsed = 0;
  let prevPoseAtTransition = moves[moves.length - 1].fn(moves[moves.length - 1].duration, basePoseFn);
  const BLEND = 0.4;

  return function tick(dt) {
    moveElapsed += dt;
    const move = moves[moveIndex];
    if (moveElapsed > move.duration) {
      prevPoseAtTransition = move.fn(move.duration, basePoseFn);
      moveIndex = (moveIndex + 1) % moves.length;
      moveElapsed = 0;
    }
    const raw = moves[moveIndex].fn(moveElapsed, basePoseFn);
    if (moveElapsed < BLEND) {
      return lerpPose(prevPoseAtTransition, raw, moveElapsed / BLEND);
    }
    return raw;
  };
}

// ---------------------------------------------------------------------------
// Hero visual: a blocky, voxel-style 3D dog that loops through a sequence of
// silly moves: a happy tail-wag idle, the zoomies, a play-bow, and a howl.
//
// Axis convention: the dog's nose-to-tail axis is local +X (so the camera,
// which looks down -Z, sees it in side profile rather than head-on). Its own
// left/right sides run along Z, and up/down is Y as usual. A part that hangs
// straight down (a leg) steps forward/back by rotating around Z. A part that
// extends along +X at rest (the head, the tail) swings side to side around Y
// and nods/raises around Z.
// ---------------------------------------------------------------------------

const DOG = {
  bodyRadius: 0.22, bodyLength: 0.65,
  headRadius: 0.24,
  snoutRadius: 0.13, snoutLength: 0.12,
  noseRadius: 0.045,
  eyeRadius: 0.045,
  earRadius: 0.11, earHeight: 0.22,
  legRadius: 0.085, legLength: 0.34,
  pawRadius: 0.1,
  tailRadius: 0.07, tailLength: 0.38,
};

function dogBasePose() {
  return {
    legFL_z: 0, legFR_z: 0, legBL_z: 0, legBR_z: 0,
    head_turn: 0, head_pitch: 0,
    tail_wag: 0, tail_lift: -25 * DEG,
    turnY: 0, hopY: 0, lean_z: 0,
  };
}

const MOVES = [
  {
    name: 'happy-wag', duration: 2.8,
    fn: (t, base) => {
      const p = base();
      p.tail_wag = Math.sin(t * 10) * 45 * DEG;
      p.head_turn = Math.sin(t * 2) * 12 * DEG;
      p.legFL_z = Math.sin(t * 3) * 8 * DEG;
      p.legFR_z = -Math.sin(t * 3) * 8 * DEG;
      p.hopY = Math.abs(Math.sin(t * 3)) * 0.04;
      return p;
    },
  },
  {
    name: 'zoomies', duration: 2.4,
    fn: (t, base) => {
      const p = base();
      p.turnY = Math.sin(t * 3) * 170 * DEG;
      const gallop = Math.sin(t * 14);
      p.legFL_z = gallop * 35 * DEG;
      p.legBR_z = gallop * 35 * DEG;
      p.legFR_z = -gallop * 35 * DEG;
      p.legBL_z = -gallop * 35 * DEG;
      p.tail_wag = Math.sin(t * 16) * 50 * DEG;
      p.hopY = Math.abs(gallop) * 0.05;
      return p;
    },
  },
  {
    name: 'play-bow', duration: 3.0,
    fn: (t, base) => {
      const p = base();
      const ease = Math.min(t / 0.5, 1);
      p.legFL_z = ease * 55 * DEG;
      p.legFR_z = ease * 55 * DEG;
      p.lean_z = ease * 12 * DEG;
      p.head_pitch = -ease * 15 * DEG;
      p.tail_wag = Math.sin(t * 9) * 40 * DEG;
      p.hopY = -ease * 0.05 + Math.abs(Math.sin(t * 2)) * 0.012;
      return p;
    },
  },
  {
    name: 'howl', duration: 2.8,
    fn: (t, base) => {
      const p = base();
      const rise = Math.min(t / 0.6, 1);
      p.head_pitch = rise * 65 * DEG;
      p.tail_wag = Math.sin(t * 3) * 15 * DEG;
      p.hopY = rise * 0.02;
      return p;
    },
  },
];

function buildDog() {
  const root = new THREE.Group();

  const furMat = new THREE.MeshStandardMaterial({ color: 0x52f2c8, roughness: 0.55, metalness: 0.05 });
  const earMat = new THREE.MeshStandardMaterial({ color: 0x7c8cff, roughness: 0.55, metalness: 0.05 });
  const pawMat = new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 0.5, metalness: 0.05 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.4, metalness: 0.1 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.3, metalness: 0.15 });

  // Body: a capsule lying on its side (capsules default to a vertical long
  // axis, so each horizontal part gets a one-time 90-degree spin).
  const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(DOG.bodyRadius, DOG.bodyLength, 4, 12), furMat);
  bodyMesh.rotation.z = Math.PI / 2;
  root.add(bodyMesh);

  const bodyFront = DOG.bodyLength / 2 + DOG.bodyRadius;
  const bodyBack = -bodyFront;
  const bodyTop = DOG.bodyRadius * 0.7;
  const bodyBottom = -DOG.bodyRadius * 0.85;

  // Head + snout + nose + eyes + ears, all children of a pitch pivot that
  // in turn hangs off a turn pivot. Two nested single-axis pivots, not one
  // object with combined Euler rotation.set(0, turn, pitch) -- composing
  // two non-zero Euler axes on one off-center mesh does not do what the
  // single-axis math alone suggests, and visibly swings the whole head off
  // to a wrong angle. Nesting one real Object3D per axis composes correctly
  // through the scene graph instead.
  const headTurnPivot = new THREE.Group();
  headTurnPivot.position.set(bodyFront - 0.04, bodyTop * 0.6, 0);
  const headPitchPivot = new THREE.Group();
  headTurnPivot.add(headPitchPivot);

  const headCenterX = DOG.headRadius * 0.55;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(DOG.headRadius, 20, 20), furMat);
  headMesh.position.set(headCenterX, 0, 0);
  headPitchPivot.add(headMesh);

  const snoutCenterX = headCenterX + DOG.headRadius * 0.85;
  const snoutY = -DOG.headRadius * 0.15;
  const snoutMesh = new THREE.Mesh(new THREE.CapsuleGeometry(DOG.snoutRadius, DOG.snoutLength, 4, 10), furMat);
  snoutMesh.position.set(snoutCenterX, snoutY, 0);
  snoutMesh.rotation.z = Math.PI / 2;
  headPitchPivot.add(snoutMesh);

  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(DOG.noseRadius, 10, 10), noseMat);
  noseMesh.position.set(snoutCenterX + DOG.snoutLength / 2 + DOG.snoutRadius * 0.3, snoutY, 0);
  headPitchPivot.add(noseMesh);

  const eyeGeo = new THREE.SphereGeometry(DOG.eyeRadius, 10, 10);
  const eyeX = headCenterX + DOG.headRadius * 0.55;
  const eyeY = DOG.headRadius * 0.15;
  const eyeZ = DOG.headRadius * 0.42;
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(eyeX, eyeY, -eyeZ);
  headPitchPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(eyeX, eyeY, eyeZ);
  headPitchPivot.add(eyeR);

  const earGeo = new THREE.ConeGeometry(DOG.earRadius, DOG.earHeight, 10);
  const earX = headCenterX - DOG.headRadius * 0.25;
  const earY = DOG.headRadius * 0.8;
  const earZ = DOG.headRadius * 0.5;
  const earL = new THREE.Mesh(earGeo, earMat);
  earL.position.set(earX, earY, -earZ);
  earL.rotation.x = -25 * DEG;
  headPitchPivot.add(earL);
  const earR = new THREE.Mesh(earGeo, earMat);
  earR.position.set(earX, earY, earZ);
  earR.rotation.x = 25 * DEG;
  headPitchPivot.add(earR);

  root.add(headTurnPivot);

  // Tail: same two-nested-pivots fix (lift pivot outer, wag pivot inner).
  const tailLiftPivot = new THREE.Group();
  tailLiftPivot.position.set(bodyBack + 0.04, bodyTop * 0.5, 0);
  const tailWagPivot = new THREE.Group();
  tailLiftPivot.add(tailWagPivot);
  const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(DOG.tailRadius, DOG.tailLength, 4, 10), earMat);
  tailMesh.position.set(-(DOG.tailLength / 2 + DOG.tailRadius * 0.3), 0, 0);
  tailMesh.rotation.z = Math.PI / 2;
  tailWagPivot.add(tailMesh);
  root.add(tailLiftPivot);

  // Legs: each hangs straight down from a hip/shoulder pivot (capsules
  // already default to a vertical long axis, so no spin needed here);
  // rotation.z swings the foot forward/back (the stepping motion).
  function makeLeg(x, z) {
    const pivot = new THREE.Group();
    pivot.position.set(x, bodyBottom, z);
    const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(DOG.legRadius, DOG.legLength, 4, 8), earMat);
    legMesh.position.set(0, -(DOG.legLength / 2 + DOG.legRadius), 0);
    pivot.add(legMesh);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(DOG.pawRadius, 12, 12), pawMat);
    paw.position.set(0, -(DOG.legLength + DOG.legRadius * 2) + DOG.pawRadius * 0.3, 0);
    pivot.add(paw);
    root.add(pivot);
    return pivot;
  }

  const legSpanZ = DOG.bodyRadius * 0.78;
  const legFLPivot = makeLeg(bodyFront - DOG.legRadius * 1.6, -legSpanZ);
  const legFRPivot = makeLeg(bodyFront - DOG.legRadius * 1.6, legSpanZ);
  const legBLPivot = makeLeg(bodyBack + DOG.legRadius * 1.6, -legSpanZ);
  const legBRPivot = makeLeg(bodyBack + DOG.legRadius * 1.6, legSpanZ);

  return { root, headTurnPivot, headPitchPivot, tailLiftPivot, tailWagPivot, legFLPivot, legFRPivot, legBLPivot, legBRPivot };
}

function applyPose(rig, pose) {
  rig.legFLPivot.rotation.z = pose.legFL_z;
  rig.legFRPivot.rotation.z = pose.legFR_z;
  rig.legBLPivot.rotation.z = pose.legBL_z;
  rig.legBRPivot.rotation.z = pose.legBR_z;
  rig.tailLiftPivot.rotation.z = pose.tail_lift;
  rig.tailWagPivot.rotation.y = pose.tail_wag;
  // Head rotation is applied separately in the render loop, blended with
  // cursor-tracking, instead of here.
}

function initHeroVisual() {
  const container = document.getElementById('avatarStage');
  if (!container || !webglOK) return;

  let width = container.clientWidth || window.innerWidth * 0.5;
  let height = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0.25, 6.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(2, 4, 3);
  scene.add(keyLight);

  const rig = buildDog();
  rig.root.scale.setScalar(0.9);
  scene.add(rig.root);

  const player = createMovePlayer(MOVES, dogBasePose);
  if (prefersReducedMotion) {
    applyPose(rig, dogBasePose());
  }

  // Horizontal/vertical cursor signal, normalized to roughly [-0.3, 0.3].
  // Reused below at different strengths for the body's position, its
  // overall tilt, and the head's tracking of the cursor.
  let targetTiltX = 0;
  let targetTiltY = 0;
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetTiltY = nx * 0.3;
    targetTiltX = ny * 0.3;
  });

  const resize = () => {
    width = container.clientWidth || window.innerWidth * 0.5;
    height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container);

  let lastTime = performance.now();
  let swayElapsed = 0;
  let currentTurnY = 0;
  let currentLean = 0;
  let currentHopY = 0;
  let currentPosX = 0;
  let currentHeadTurn = 0;
  let currentHeadPitch = 0;

  const animate = () => {
    requestAnimationFrame(animate);
    if (document.hidden) return;
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!prefersReducedMotion) {
      const pose = player(dt);
      applyPose(rig, pose);

      swayElapsed += dt;
      currentTurnY += ((Math.sin(swayElapsed * 0.15) * 0.3 + targetTiltY * 0.5 + pose.turnY) - currentTurnY) * 0.05;
      currentLean += (pose.lean_z - currentLean) * 0.15;
      currentHopY += (pose.hopY - currentHopY) * 0.3;
      // Nudge the whole dog toward the cursor side (the "moving to the
      // side" effect), slower/lazier than the head tracking below.
      currentPosX += ((targetTiltY * 1.3) - currentPosX) * 0.04;
      // Head turns to track the cursor directly (carries the eyes with
      // it), faster/snappier than the body, layered on top of whatever
      // the current dance move is doing with the head.
      currentHeadTurn += ((pose.head_turn + targetTiltY * 0.8) - currentHeadTurn) * 0.12;
      currentHeadPitch += ((pose.head_pitch + targetTiltX * 0.6) - currentHeadPitch) * 0.12;

      rig.root.rotation.y = currentTurnY;
      rig.root.rotation.x = targetTiltX * 0.08;
      rig.root.rotation.z = currentLean;
      rig.root.position.y = currentHopY - 0.1;
      rig.root.position.x = currentPosX;
      rig.headTurnPivot.rotation.y = currentHeadTurn;
      rig.headPitchPivot.rotation.z = currentHeadPitch;
    }

    renderer.render(scene, camera);
  };
  animate();
}

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
  const worldHeight = 0.5;
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
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const sprites = SKILLS.map((skill, i) => {
    const count = SKILLS.length;
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const radius = 2.7;
    const sprite = makeLabelSprite(skill.label, skill.color);
    sprite.position.set(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius);
    group.add(sprite);
    return sprite;
  });

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
      const target = sprite === hovered ? 1.35 : 1;
      const base = sprite.userData.baseScale;
      sprite.scale.x += (base.x * target - sprite.scale.x) * 0.2;
      sprite.scale.y += (base.y * target - sprite.scale.y) * 0.2;
    });
    renderer.render(scene, camera);
  };
  animate();
}

try { initHeroVisual(); } catch (e) { console.warn('Hero visual failed to initialize', e); }
try { initStackScene(); } catch (e) { console.warn('Skills tag cloud failed to initialize', e); }
