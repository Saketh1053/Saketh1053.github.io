// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Active nav link highlight on scroll (only runs on pages with id'd sections)
const sections = document.querySelectorAll('main section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href*="#"]');

if (sections.length && navAnchors.length) {
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });
    navAnchors.forEach(a => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href.endsWith(`#${current}`) && current !== '');
    });
  });
}

// Evidence screenshots: show real image on load, keep placeholder on error
document.querySelectorAll('.evidence-img').forEach(img => {
  img.addEventListener('load', () => {
    img.classList.add('loaded');
    const placeholder = img.parentElement.querySelector('.evidence-placeholder');
    if (placeholder) placeholder.style.display = 'none';
  });
  img.addEventListener('error', () => {
    img.style.display = 'none';
  });
});

// Lightbox for evidence screenshots
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  const lightboxImg = lightbox.querySelector('img');
  const lightboxClose = lightbox.querySelector('.lightbox-close');

  document.querySelectorAll('.evidence-img').forEach(img => {
    img.addEventListener('click', () => {
      if (!img.classList.contains('loaded')) return;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add('open');
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightboxImg.src = '';
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}
