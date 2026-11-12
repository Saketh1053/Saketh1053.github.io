// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Slide the fixed hero visual off to the side and fade it out once the hero
// has scrolled out of view, so it doesn't sit behind later sections' text.
const avatarStage = document.getElementById('avatarStage');
const heroSection = document.getElementById('home');
if (avatarStage && heroSection) {
  const updateStageVisibility = () => {
    const rect = heroSection.getBoundingClientRect();
    const pastHero = rect.bottom < window.innerHeight * 0.4;
    avatarStage.classList.toggle('offstage', pastHero);
  };
  window.addEventListener('scroll', updateStageVisibility, { passive: true });
  updateStageVisibility();
}

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  const closeMobileNav = () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('click', (e) => {
    if (!navLinks.classList.contains('open')) return;
    if (navLinks.contains(e.target) || navToggle.contains(e.target)) return;
    closeMobileNav();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) closeMobileNav();
  });
}

// Active nav link highlight on scroll (single-page sections only)
const sections = document.querySelectorAll('main section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

if (sections.length && navAnchors.length) {
  const updateActiveNav = () => {
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let current = atBottom ? sections[sections.length - 1].getAttribute('id') : '';
    if (!atBottom) {
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 140;
        if (window.scrollY >= sectionTop) current = section.getAttribute('id');
      });
    }
    navAnchors.forEach(a => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', current !== '' && href === `#${current}`);
    });
  };
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();
}

// Custom two-part cursor (desktop, fine-pointer only)
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const root = document.documentElement;
  const hotSelector = 'a, button, .work-card, .focus-card, .evidence-trigger, input, textarea, [role="button"]';

  window.addEventListener('mousemove', (e) => {
    root.classList.add('has-cursor');
    root.style.setProperty('--cx', `${e.clientX}px`);
    root.style.setProperty('--cy', `${e.clientY}px`);
  });

  document.addEventListener('pointerover', (e) => {
    if (e.target.closest(hotSelector)) root.classList.add('cursor-hot');
  });
  document.addEventListener('pointerout', (e) => {
    const toHot = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(hotSelector);
    if (e.target.closest(hotSelector) && !toHot) root.classList.remove('cursor-hot');
  });
}

// Focus-card cursor spotlight (local to each card)
document.querySelectorAll('.focus-card').forEach(card => {
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    card.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
});

// Hero role-title rotator
const roleMask = document.getElementById('roleMask');
if (roleMask && !prefersReducedMotion) {
  const roles = roleMask.querySelectorAll('.role');
  let roleIndex = 0;
  if (roles.length > 1) {
    setInterval(() => {
      if (document.hidden) return;
      roles[roleIndex].classList.remove('active');
      roleIndex = (roleIndex + 1) % roles.length;
      roles[roleIndex].classList.add('active');
    }, 2600);
  }
}

// Boot loader: types the name onto a row of keycaps, then reveals the page
const loader = document.getElementById('loader');
if (loader) {
  const NAME = 'SAKETH';
  const readout = document.getElementById('loaderReadout');
  const keysWrap = document.getElementById('loaderKeys');
  const bar = document.getElementById('loaderBar');

  NAME.split('').forEach(ch => {
    const key = document.createElement('span');
    key.className = 'loader-key';
    key.textContent = ch;
    keysWrap.appendChild(key);
  });
  const keyEls = keysWrap.children;

  const finish = () => loader.classList.add('done');

  if (prefersReducedMotion) {
    readout.textContent = NAME;
    bar.style.width = '100%';
    requestAnimationFrame(finish);
  } else {
    let i = 0;
    const typed = [];
    const caretHTML = '<span class="loader-caret">&nbsp;</span>';

    const step = () => {
      if (i < NAME.length) {
        typed.push(NAME[i]);
        readout.innerHTML = typed.join('') + caretHTML;
        const keyEl = keyEls[i];
        if (keyEl) {
          keyEl.classList.add('down');
          setTimeout(() => keyEl.classList.remove('down'), 160);
        }
        bar.style.width = `${((i + 1) / NAME.length) * 100}%`;
        i++;
        setTimeout(step, 190);
      } else {
        setTimeout(finish, 450);
      }
    };
    setTimeout(step, 300);

    loader.addEventListener('click', finish);
    window.addEventListener('keydown', finish, { once: true });
  }
}

// Key-drop easter egg: press a letter from SAKETH to drop a bouncing keycap
const keydropZone = document.getElementById('keydropZone');
if (keydropZone && !prefersReducedMotion) {
  const NAME_CHARS = new Set('SAKETH'.split(''));
  const letters = [];
  const MAX_LETTERS = 14;
  const SIZE = 42;
  const GRAVITY = 0.55;
  const BOUNCE = 0.5;
  const FRICTION = 0.985;

  const spawnLetter = (ch) => {
    const rect = keydropZone.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'keydrop-letter';
    el.textContent = ch;
    keydropZone.appendChild(el);
    letters.push({
      el,
      x: Math.random() * Math.max(rect.width - SIZE, 0),
      y: -SIZE,
      vx: (Math.random() - 0.5) * 3,
      vy: 0,
    });
    if (letters.length > MAX_LETTERS) {
      const old = letters.shift();
      old.el.remove();
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const ch = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (ch && NAME_CHARS.has(ch)) spawnLetter(ch);
  });

  const tick = () => {
    if (!document.hidden && letters.length) {
      const rect = keydropZone.getBoundingClientRect();
      const maxX = Math.max(rect.width - SIZE, 0);
      const maxY = Math.max(rect.height - SIZE, 0);
      letters.forEach(l => {
        l.vy += GRAVITY;
        l.x += l.vx;
        l.y += l.vy;
        if (l.x < 0) { l.x = 0; l.vx *= -BOUNCE; }
        if (l.x > maxX) { l.x = maxX; l.vx *= -BOUNCE; }
        if (l.y > maxY) { l.y = maxY; l.vy *= -BOUNCE; l.vx *= FRICTION; }
        l.el.style.transform = `translate(${l.x}px, ${l.y}px)`;
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Timeline: light up dots as they enter view, grow the fill line to match
const tlItems = document.querySelectorAll('.tl-item');
const tlFill = document.getElementById('tlFill');
if (tlItems.length && tlFill) {
  const tlObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('lit');
    });
    const litCount = document.querySelectorAll('.tl-item.lit').length;
    tlFill.style.transform = `scaleY(${litCount / tlItems.length})`;
  }, { threshold: 0.5 });
  tlItems.forEach(item => tlObserver.observe(item));
}

// Work section: horizontal scroll-snap track with a progress indicator
const workTrack = document.getElementById('workTrack');
const workProgress = document.getElementById('workProgress');
if (workTrack && workProgress) {
  const updateWorkProgress = () => {
    const max = workTrack.scrollWidth - workTrack.clientWidth;
    const pct = max > 0 ? (workTrack.scrollLeft / max) * 100 : 0;
    workProgress.style.width = `${pct}%`;
  };
  workTrack.addEventListener('scroll', updateWorkProgress, { passive: true });
  window.addEventListener('resize', updateWorkProgress);
  updateWorkProgress();

  // Let vertical wheel input drive the horizontal track too, since most
  // trackpads and mice do not produce horizontal deltas on their own.
  workTrack.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      workTrack.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
}

// Scroll-reveal: fade up cards/rows the first time they enter view
if ('IntersectionObserver' in window) {
  const revealItems = document.querySelectorAll('.focus-card, .work-card, .row, .skill-row, .test-card, .evidence-item');
  revealItems.forEach((item, i) => {
    item.classList.add('reveal');
    item.style.transitionDelay = `${Math.min((i % 6) * 60, 300)}ms`;
  });
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealItems.forEach(item => revealObserver.observe(item));
}

// Evidence screenshots: show real image on load, keep placeholder on error.
document.querySelectorAll('.evidence-img').forEach(img => {
  const showLoaded = () => img.classList.add('loaded');
  const showError = () => { img.style.display = 'none'; };

  if (img.complete) {
    if (img.naturalWidth > 0) showLoaded(); else showError();
  } else {
    img.addEventListener('load', showLoaded);
    img.addEventListener('error', showError);
  }
});

// Lightbox for evidence screenshots (HealthGuide AI case study page)
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  const lightboxImg = lightbox.querySelector('img');
  const lightboxClose = lightbox.querySelector('.lightbox-close');
  let lastTrigger = null;

  document.querySelectorAll('.evidence-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const img = trigger.querySelector('.evidence-img');
      if (!img || !img.classList.contains('loaded')) return;
      lastTrigger = trigger;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add('open');
      requestAnimationFrame(() => { requestAnimationFrame(() => lightboxClose.focus()); });
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('open');
    if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });
}
