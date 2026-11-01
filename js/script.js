// Pause the ambient background blobs and particles when the tab isn't visible
const movingBgEls = document.querySelectorAll('.blob, .particle');
if (movingBgEls.length) {
  document.addEventListener('visibilitychange', () => {
    const state = document.hidden ? 'paused' : 'running';
    movingBgEls.forEach(el => { el.style.animationPlayState = state; });
  });
}

// Cursor-following glow, tracked across the entire page (viewport-relative,
// not scoped to any one element), so it responds no matter where the
// visitor hovers. Activates on first movement and stays on.
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const root = document.documentElement;
  window.addEventListener('mousemove', (e) => {
    root.classList.add('mouse-active');
    root.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}%`);
    root.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}%`);
  });
}

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.setAttribute('aria-expanded', 'false');

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

  // Close on outside click/tap
  document.addEventListener('click', (e) => {
    if (!navLinks.classList.contains('open')) return;
    if (navLinks.contains(e.target) || navToggle.contains(e.target)) return;
    closeMobileNav();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) closeMobileNav();
  });
}

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Active nav link highlight on scroll (only runs on pages with id'd sections).
// Matches by substring (href.includes(id)) rather than requiring a literal
// "#id" suffix, so a nav item pointing at a dedicated page (e.g. Projects ->
// projects.html) still lights up while scrolling through the same-named
// section embedded on the homepage.
const sections = document.querySelectorAll('main section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

if (sections.length && navAnchors.length) {
  const updateActiveNav = () => {
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let current = atBottom ? sections[sections.length - 1].getAttribute('id') : '';
    if (!atBottom) {
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) current = section.getAttribute('id');
      });
    }
    navAnchors.forEach(a => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', current !== '' && href.includes(current));
    });
  };
  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav();
}

// Evidence screenshots: show real image on load, keep placeholder on error.
// Images can finish loading (from cache or a fast connection) before this
// script runs and attaches its listeners, so check img.complete first
// instead of relying solely on the 'load' event firing afterward.
document.querySelectorAll('.evidence-img').forEach(img => {
  const showLoaded = () => {
    img.classList.add('loaded');
  };
  const showError = () => {
    img.style.display = 'none';
  };

  if (img.complete) {
    if (img.naturalWidth > 0) showLoaded(); else showError();
  } else {
    img.addEventListener('load', showLoaded);
    img.addEventListener('error', showError);
  }
});

// Lightbox for evidence screenshots. Keyboard-accessible: the screenshot is
// a real <button> (focusable, Enter/Space activate it natively), the
// lightbox is announced as a dialog, and focus moves in on open and back to
// the triggering button on close.
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
      // Deferred: the element is still mid-transition (visibility/opacity)
      // at the instant the class is added, and some browsers won't move
      // focus onto an element until a frame has actually painted it.
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

// Scroll-reveal: fade up grid/list items the first time they enter view.
// Delay is staggered per item within its own container, not globally.
if ('IntersectionObserver' in window) {
  const revealGroups = document.querySelectorAll(
    '.skills-list, .projects-grid, .timeline, .education-list, .test-grid, .evidence-gallery'
  );

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealGroups.forEach(group => {
    Array.from(group.children).forEach((item, i) => {
      item.classList.add('reveal');
      item.style.transitionDelay = `${Math.min(i * 60, 300)}ms`;
      io.observe(item);
    });
  });
}
