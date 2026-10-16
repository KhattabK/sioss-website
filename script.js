// ── Navbar: shrink on scroll ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile burger ──
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => {
  burger.setAttribute('aria-expanded', navLinks.classList.toggle('open'));
});

// Close nav on link click (mobile)
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  });
});

// ── Hero video: the poster paints first; the 18 MB clip loads after the page,
//    and not at all on data-saver / slow connections or with reduced motion ──
const heroVideo = document.querySelector('.hero-video[data-hero-src]');
if (heroVideo) {
  const conn = navigator.connection || {};
  const skip = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!skip) {
    window.addEventListener('load', () => {
      heroVideo.autoplay = true;
      heroVideo.src = heroVideo.dataset.heroSrc;
      heroVideo.play().catch(() => {});
    });
  }
}

// Certificate cards open with Enter / Space as well as a click
document.querySelectorAll('.cert-card[role="button"]').forEach(card => {
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
  });
});

// ── Lazy videos: fetch nothing until the section is near the viewport ──
const lazyVideoObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const video = entry.target;
    video.preload = 'metadata';
    video.src = video.dataset.src;
    obs.unobserve(video);
  });
}, { rootMargin: '600px 0px' });
document.querySelectorAll('video[data-src]').forEach(v => lazyVideoObserver.observe(v));

// Play buttons must work even if the observer has not fired yet
function ensureVideoSrc(video) {
  if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
}

// ── Video play / pause ──
document.querySelectorAll('.reel-wrap').forEach(wrap => {
  const video = wrap.querySelector('video');
  const btn   = wrap.querySelector('.play-btn');

  // Seek to 1.5s once metadata is ready to avoid black/green opening frames
  video.addEventListener('loadedmetadata', () => {
    video.currentTime = 1.5;
  });

  function pauseAll() {
    document.querySelectorAll('.reel-wrap').forEach(w => {
      w.querySelector('video').pause();
      w.classList.remove('playing');
    });
  }

  btn.addEventListener('click', () => {
    if (video.paused) {
      pauseAll();
      ensureVideoSrc(video);
      video.currentTime = 0;
      video.play();
      wrap.classList.add('playing');
    } else {
      video.pause();
      wrap.classList.remove('playing');
    }
  });

  video.addEventListener('click', () => {
    video.pause();
    wrap.classList.remove('playing');
  });

  // Pause when scrolled out of view
  const visibilityObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting && !video.paused) {
        video.pause();
        wrap.classList.remove('playing');
      }
    });
  }, { threshold: 0.2 });

  visibilityObserver.observe(wrap);
});

// ── Contact form → Formspree ──
document.getElementById('contactForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const note = document.getElementById('formNote');
  const btn  = this.querySelector('[type="submit"]');
  // Honeypot: a real visitor never fills the hidden field
  if (this.querySelector('[name="_gotcha"]').value) return;
  btn.disabled = true;
  btn.textContent = siossT('form_sending');

  const data = {
    name:    this.querySelector('[name="name"]').value,
    email:   this.querySelector('[name="email"]').value,
    subject: this.querySelector('[name="subject"]').value,
    message: this.querySelector('[name="message"]').value,
  };

  fetch('https://formspree.io/f/xyeklrky', {
    method:  'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  })
  .then(res => res.json().then(body => ({ ok: res.ok, body })))
  .then(({ ok, body }) => {
    if (ok && body.ok) {
      note.textContent = siossT('form_success');
      note.className   = 'form-note success';
      this.reset();
      setTimeout(() => { note.textContent = ''; note.className = 'form-note'; }, 6000);
    } else {
      console.error('Contact form error:', body.errors || body.error);
      note.textContent = siossT('form_error');
      note.className   = 'form-note error';
    }
  })
  .catch(() => {
    note.textContent = siossT('form_network');
    note.className   = 'form-note error';
  })
  .finally(() => {
    btn.disabled = false;
    btn.textContent = siossT('form_submit');
  });
});

// ── Video carousel scroll arrows ──
const videoGrid  = document.getElementById('videoGrid');
const btnLeft    = document.getElementById('scrollLeft');
const btnRight   = document.getElementById('scrollRight');
const SCROLL_AMT = 560;

if (videoGrid && btnLeft && btnRight) {
  btnLeft.addEventListener('click',  () => videoGrid.scrollBy({ left: -SCROLL_AMT, behavior: 'smooth' }));
  btnRight.addEventListener('click', () => videoGrid.scrollBy({ left:  SCROLL_AMT, behavior: 'smooth' }));

  // Drag to scroll
  let isDown = false, startX, scrollLeft;
  videoGrid.addEventListener('mousedown', e => {
    isDown = true; startX = e.pageX - videoGrid.offsetLeft; scrollLeft = videoGrid.scrollLeft;
  });
  videoGrid.addEventListener('mouseleave', () => isDown = false);
  videoGrid.addEventListener('mouseup',    () => isDown = false);
  videoGrid.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    const x    = e.pageX - videoGrid.offsetLeft;
    const walk = (x - startX) * 1.5;
    videoGrid.scrollLeft = scrollLeft - walk;
  });
}

// ── Image Lightbox ──
const lightbox      = document.getElementById('lightbox');
const lightboxImg   = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');

document.querySelectorAll('.photo-slide img').forEach(img => {
  img.addEventListener('click', () => {
    if (img.closest('.photo-scroll-track').dataset.dragged === '1') return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
});

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── Testimonial videos ──
document.querySelectorAll('.tv-wrap').forEach(wrap => {
  const video = wrap.querySelector('video');
  const btn   = wrap.querySelector('.tv-play');
  video.addEventListener('loadedmetadata', () => { video.currentTime = 0.5; });
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tv-wrap').forEach(w => {
      if (w !== wrap) { w.querySelector('video').pause(); w.classList.remove('playing'); w.querySelector('.tv-play').style.display = ''; }
    });
    ensureVideoSrc(video);
    video.play();
    wrap.classList.add('playing');
  });
  video.addEventListener('click', () => { video.pause(); wrap.classList.remove('playing'); });
  video.addEventListener('ended', () => { wrap.classList.remove('playing'); });
});

// ── Photo scroll galleries ──
function initPhotoScroll(trackId, leftId, rightId) {
  const track = document.getElementById(trackId);
  const left  = document.getElementById(leftId);
  const right = document.getElementById(rightId);
  if (!track || !left || !right) return;
  const AMT = 400;
  left.addEventListener('click',  () => track.scrollBy({ left: -AMT, behavior: 'smooth' }));
  right.addEventListener('click', () => track.scrollBy({ left:  AMT, behavior: 'smooth' }));
  let isDown = false, startX, scrollLeft;
  track.addEventListener('mousedown', e => { isDown = true; track.dataset.dragged = ''; startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft; });
  track.addEventListener('mouseleave', () => isDown = false);
  track.addEventListener('mouseup',    () => isDown = false);
  track.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    const dx = e.pageX - track.offsetLeft - startX;
    if (Math.abs(dx) > 5) track.dataset.dragged = '1';
    track.scrollLeft = scrollLeft - dx * 1.5;
  });

  // Large coloured arrows on both sides of the row, plus a hint, so visitors see there is more to browse.
  const wrap = track.parentElement;
  wrap.classList.add('has-side-arrows');
  left.parentElement.classList.add('replaced');
  const chevron = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="${d}"/></svg>`;
  const mk = (side, pts, dir) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'side-arrow ' + side; b.setAttribute('aria-label', side === 'left' ? 'Scroll left' : 'Scroll right');
    b.innerHTML = chevron(pts);
    b.addEventListener('click', () => track.scrollBy({ left: dir * Math.max(260, track.clientWidth * 0.8), behavior: 'smooth' }));
    wrap.appendChild(b); return b;
  };
  const sl = mk('left', '15,18 9,12 15,6', -1), sr = mk('right', '9,18 15,12 9,6', 1);
  const hint = document.createElement('p');
  hint.className = 'scroll-hint';
  wrap.after(hint);
  const update = () => {
    const rtl = getComputedStyle(track).direction === 'rtl';
    const pos = Math.abs(track.scrollLeft), max = track.scrollWidth - track.clientWidth;
    const fromStart = pos > 4, toEnd = pos < max - 4;
    sl.hidden = !(rtl ? toEnd : fromStart);
    sr.hidden = !(rtl ? fromStart : toEnd);
    const n = track.children.length;
    hint.hidden = max < 4;
    hint.textContent = document.documentElement.lang === 'ar'
      ? `⟵ اضغط السهم أو اسحب لرؤية الكل (${n}) ⟶`
      : `⟵ Use the arrows or swipe to see all ${n} ⟶`;
  };
  track.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
  update(); setTimeout(update, 800);
}
initPhotoScroll('certsTrack',   'certsLeft',   'certsRight');
initPhotoScroll('bahrainTrack', 'bahrainLeft', 'bahrainRight');
initPhotoScroll('iraqTrack',    'iraqLeft',    'iraqRight');
initPhotoScroll('fieldTrack',   'fieldLeft',   'fieldRight');

// ── Hero slider: SIOSS, the online courses and the journal ──
(function () {
  const hero = document.querySelector('.hero[aria-roledescription="carousel"]');
  if (!hero) return;
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const dotsBox = hero.querySelector('.hero-dots');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0, timer = null, paused = false;
  slides.forEach(s => s.hidden = false);
  const dots = slides.map((s, k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', String(k + 1));
    b.addEventListener('click', () => { go(k); restart(); });
    dotsBox.appendChild(b); return b;
  });
  function go(k) {
    i = (k + slides.length) % slides.length;
    slides.forEach((s, n) => {
      const on = n === i;
      s.classList.toggle('is-active', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      s.querySelectorAll('a,button').forEach(el => { if (!el.classList.contains('hero-card')) el.tabIndex = on ? 0 : -1; });
    });
    dots.forEach((d, n) => d.setAttribute('aria-selected', n === i ? 'true' : 'false'));
  }
  function restart() { clearInterval(timer); if (!still) timer = setInterval(() => { if (!paused && !document.hidden) go(i + 1); }, 7000); }
  hero.querySelector('.hero-nav.prev').addEventListener('click', () => { go(i - 1); restart(); });
  hero.querySelector('.hero-nav.next').addEventListener('click', () => { go(i + 1); restart(); });
  hero.addEventListener('mouseenter', () => paused = true);
  hero.addEventListener('mouseleave', () => paused = false);
  hero.addEventListener('focusin', () => paused = true);
  hero.addEventListener('focusout', () => paused = false);
  let x0 = null;
  hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) < 50) return;
    const rtl = document.documentElement.dir === 'rtl';
    go(i + ((dx < 0) !== rtl ? 1 : -1)); restart();
  });
  // ?slide=N opens the page on a given slide (handy for links from adverts)
  go(parseInt(new URLSearchParams(location.search).get('slide'), 10) || 0); restart();
})();
