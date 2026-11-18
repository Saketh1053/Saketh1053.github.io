(function () {
  const dog = document.getElementById('dogSprite');
  if (!dog) return;

  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sprite sheet is a 6-column x 6-row grid (assets/dog/dog-sprites.png).
  const COLS = 6;
  const ROWS = 6;
  const ANIM = {
    walk: { row: 0, frames: 6, fps: 10, loop: true },
    idle: { row: 1, frames: 6, fps: 3, loop: true },
    jump: { row: 2, frames: 6, fps: 10, loop: false },
    playbow: { row: 3, frames: 6, fps: 8, loop: false },
    pawwave: { row: 4, frames: 6, fps: 8, loop: false },
    rollover: { row: 5, frames: 6, fps: 8, loop: false },
  };
  const TRICKS = ['jump', 'playbow', 'pawwave', 'rollover'];

  // Two resting spots, read live from zero-size marker elements placed in
  // actual empty space on the page (see .dog-slot in index.html/style.css)
  // -- not percentage guesses, so this stays correct regardless of content
  // length, font size, or viewport height.
  const slotHome = document.getElementById('dogSlotHome');
  const slotAbout = document.getElementById('dogSlotAbout');
  if (!slotHome || !slotAbout) return;

  // A marker viewport position (getBoundingClientRect) changes as you
  // scroll, same as everything else on the page -- it is not a fixed point.
  // Converting to document-relative coordinates (viewport position plus
  // current scroll offset) gives a value that stays constant regardless of
  // scroll, which is what a stable Bezier endpoint actually needs.
  function slotDocPoint(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY };
  }

  let homeDoc = slotDocPoint(slotHome);
  let aboutDoc = slotDocPoint(slotAbout);

  // Once the whole About section has scrolled past, the dog shouldn't just
  // sit pinned over whatever comes next forever -- it should carry on
  // walking off the left edge and disappear, the same way it arrived.
  const aboutSection = document.getElementById('about');
  let aboutBottomDoc = aboutSection
    ? aboutSection.getBoundingClientRect().bottom + window.scrollY
    : aboutDoc.y + 600;

  // The About heading itself -- not just the resting-spot markers. It's a
  // normal-flow element that scrolls up through the viewport during the
  // walk, so a straight line between the two resting spots cuts right
  // through wherever it currently sits partway through the scroll. Reading
  // its live rect each tick (instead of baking a fixed detour into the
  // curve) lets the dog rise only exactly as much, and only exactly when,
  // it would otherwise overlap -- whatever the viewport size or copy length.
  const aboutHeading = document.querySelector('.about-lead');
  const AVOID_MARGIN = 28;
  const AVOID_SOFTEN = 150;

  const HALF_W = 230;
  const HALF_H = 128;
  // How much scrolling (in viewport heights) the whole home-to-about walk
  // takes. The dog position is a direct function of scroll progress, not
  // a time-based animation -- it never sits statically at a fixed screen
  // spot while page content scrolls past underneath it, which is exactly
  // what caused it to collide with text before.
  const TRANSITION_RANGE_VH = 0.9;
  // How much extra scrolling (in viewport heights), once the About section
  // is fully behind you, it takes the dog to finish walking off-screen.
  const EXIT_RANGE_VH = 0.4;

  function setFrame(animName, frameIndex) {
    const anim = ANIM[animName];
    const col = frameIndex % anim.frames;
    const bgX = (col / (COLS - 1)) * 100;
    const bgY = (anim.row / (ROWS - 1)) * 100;
    dog.style.backgroundPosition = `${bgX}% ${bgY}%`;
  }

  let x = 0;
  let y = 0;
  let facing = -1; // sprite art faces right at rest; -1 flips it to face left
  let state = 'idle';
  let frame = 0;
  let frameElapsed = 0;
  let lastProgress = -1;

  function isDoingTrick() {
    return TRICKS.indexOf(state) !== -1;
  }

  const EDGE_PAD = 16;
  let exitProgress = 0;

  // Safety net: whatever produced x/y (marker CSS, future size tweaks,
  // an unusually narrow viewport), never actually render past the edge --
  // except while deliberately walking off during the exit phase, where
  // going past the left edge is the whole point.
  function clampToViewport() {
    const minY = HALF_H + EDGE_PAD;
    const maxY = window.innerHeight - HALF_H - EDGE_PAD;
    if (maxY > minY) y = Math.max(minY, Math.min(maxY, y));
    if (exitProgress <= 0) {
      const minX = HALF_W + EDGE_PAD;
      const maxX = window.innerWidth - HALF_W - EDGE_PAD;
      if (maxX > minX) x = Math.max(minX, Math.min(maxX, x));
    }
  }

  function place() {
    clampToViewport();
    dog.style.left = `${Math.round(x - HALF_W)}px`;
    dog.style.top = `${Math.round(y - HALF_H)}px`;
    dog.style.transform = `scaleX(${facing})`;
  }

  function scrollProgress() {
    const range = window.innerHeight * TRANSITION_RANGE_VH;
    return Math.max(0, Math.min(1, window.scrollY / range));
  }

  // Position is a direct straight-line interpolation between the two resting
  // spots, evaluated at the current scroll progress (not elapsed time). The
  // transition window has genuinely empty space between the hero content and
  // the About heading, so the dog just walks straight across it at constant
  // size, rather than detouring toward any particular edge.
  function updateFromScroll() {
    if (isDoingTrick()) return;
    const range = window.innerHeight * TRANSITION_RANGE_VH;
    // Viewport position home/about WOULD be at, specifically at scrollY=0
    // and scrollY=range respectively -- fixed values, not live ones.
    const p0 = { x: homeDoc.x, y: homeDoc.y };
    const p3 = { x: aboutDoc.x, y: aboutDoc.y - range };

    const t = scrollProgress();
    const linearX = p0.x + (p3.x - p0.x) * t;
    const linearY = p0.y + (p3.y - p0.y) * t;
    let newX = linearX;
    let newY = linearY;

    // Rise clear of the About heading if the straight-line path would
    // currently cut through it. avoidY is only ever <= linearY (it never
    // pulls the dog down), and right at the moment the two paths would
    // otherwise diverge they're equal, so blending between them never
    // produces a visible jump.
    if (aboutHeading && t > 0 && t < 1) {
      const hr = aboutHeading.getBoundingClientRect();
      const avoidY = Math.min(linearY, hr.top - AVOID_MARGIN - HALF_H);
      const dogLeft = linearX - HALF_W;
      const dogRight = linearX + HALF_W;
      // Full avoidance (weight 1) whenever the dog's box actually overlaps
      // the heading's box horizontally; fading only over the soften margin
      // just outside that box, so the dog doesn't snap in and out right at
      // the edge.
      const gap = dogLeft > hr.right ? dogLeft - hr.right
        : dogRight < hr.left ? hr.left - dogRight
        : 0;
      // Eased (not linear) so the lift in and the settle back down both
      // taper gradually -- a linear ramp over a short gap compresses a
      // sizeable vertical change into very little horizontal travel, which
      // reads as a sudden drop rather than a step down.
      const w = Math.max(0, Math.min(1, 1 - gap / AVOID_SOFTEN));
      const weight = w * w * (3 - 2 * w);
      newY = linearY + (avoidY - linearY) * weight;
    }

    // Phase 2: once the About section's bottom edge has scrolled up past
    // the viewport, keep walking left off-screen and fade out, instead of
    // staying pinned there for the rest of the page. Purely a function of
    // scrollY, same as the walk itself, so scrolling back up reverses it.
    const exitRange = window.innerHeight * EXIT_RANGE_VH;
    const exitStart = aboutBottomDoc - window.innerHeight;
    exitProgress = exitRange > 0
      ? Math.max(0, Math.min(1, (window.scrollY - exitStart) / exitRange))
      : 0;
    if (exitProgress > 0) {
      const exitDistance = p3.x + HALF_W + 60;
      newX -= exitProgress * exitDistance;
      facing = -1;
    }
    dog.style.opacity = String(1 - exitProgress);

    if (Math.abs(newX - x) > 0.3 && exitProgress <= 0) facing = newX > x ? 1 : -1;
    x = newX;
    y = newY;

    const walking = (t > 0 && t < 1) || (exitProgress > 0 && exitProgress < 1);
    if (walking) {
      if (state !== 'walk') { state = 'walk'; frame = 0; frameElapsed = 0; }
    } else if (state === 'walk') {
      state = 'idle';
      frame = 0;
      frameElapsed = 0;
    }
    lastProgress = t;
    place();
  }

  // A 'scroll' event only fires while scrolling is actually happening, so
  // reacting to it alone leaves the dog stuck mid-walk-cycle forever once
  // the user stops scrolling partway through the transition -- nothing
  // ever runs again to notice the page is now still. Settle it into idle,
  // right where it is, a short beat after the last scroll event.
  let scrollIdleTimer = null;
  function onScroll() {
    updateFromScroll();
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(() => {
      if (state === 'walk') {
        state = 'idle';
        frame = 0;
        frameElapsed = 0;
      }
    }, 150);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    homeDoc = slotDocPoint(slotHome);
    aboutDoc = slotDocPoint(slotAbout);
    if (aboutSection) {
      aboutBottomDoc = aboutSection.getBoundingClientRect().bottom + window.scrollY;
    }
    updateFromScroll();
  });

  // Look at the cursor: while just resting (idle, not mid-walk or mid-trick),
  // face toward whichever side the cursor is on. No movement, just orientation.
  document.addEventListener('pointermove', (e) => {
    if (prefersReducedMotion) return;
    if (state !== 'idle') return;
    facing = e.clientX > x ? 1 : -1;
  });

  dog.addEventListener('click', () => {
    if (prefersReducedMotion) return;
    const trick = TRICKS[Math.floor(Math.random() * TRICKS.length)];
    state = trick;
    frame = 0;
    frameElapsed = 0;
  });

  if (prefersReducedMotion) {
    x = homeDoc.x;
    y = homeDoc.y;
    setFrame('idle', 0);
    place();
    return;
  }

  let lastTime = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const anim = ANIM[state];
    frameElapsed += dt;
    const frameDuration = 1 / anim.fps;
    if (frameElapsed >= frameDuration) {
      frameElapsed -= frameDuration;
      frame++;
      if (frame >= anim.frames) {
        if (anim.loop) {
          frame = 0;
        } else {
          frame = anim.frames - 1;
          state = 'idle';
          frameElapsed = 0;
          updateFromScroll();
        }
      }
    }
    setFrame(state, frame);
    place();
  }

  requestAnimationFrame(tick);
  updateFromScroll();
})();
