/* Haus Felder Garfrescha – Interaktionen */
(function () {
  // Header-Zustand beim Scrollen
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile Navigation
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      document.body.classList.remove('nav-open');
    }));
  }

  // Reveal-Animationen
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  // Saison-Umschalter im Hero
  document.querySelectorAll('.season-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const winter = document.getElementById('heroWinter');
      const sommer = document.getElementById('heroSommer');
      if (winter && sommer) {
        const isWinter = btn.dataset.season === 'winter';
        winter.classList.toggle('active', isWinter);
        sommer.classList.toggle('active', !isWinter);
      }
    });
  });

  // Lightbox
  const lb = document.getElementById('lightbox');
  if (lb) {
    const lbImg = lb.querySelector('img');
    let group = [];
    let index = 0;

    function show(i) {
      index = (i + group.length) % group.length;
      lbImg.src = group[index].src;
      lbImg.alt = group[index].alt || '';
    }
    function open(imgs, i) {
      group = imgs; show(i);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lb.hidden = true;
      document.body.style.overflow = '';
    }

    document.querySelectorAll('img[data-lightbox]').forEach(img => {
      img.addEventListener('click', () => {
        const imgs = Array.from(document.querySelectorAll(`img[data-lightbox="${img.dataset.lightbox}"]`));
        open(imgs, imgs.indexOf(img));
      });
    });

    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
    lb.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    // Touch-Swipe in der Lightbox
    let startX = null;
    lb.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
  }
})();
