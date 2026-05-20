// ── Navbar: shrink on scroll ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.style.background = window.scrollY > 40
    ? 'rgba(13,17,23,.98)'
    : 'rgba(13,17,23,.85)';
});

// ── Mobile burger ──
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close nav on link click (mobile)
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

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
  btn.disabled = true;
  btn.textContent = '…';

  const data = {
    name:    this.querySelector('[name="name"]').value,
    email:   this.querySelector('[name="email"]').value,
    subject: this.querySelector('[name="subject"]').value,
    message: this.querySelector('[name="message"]').value,
  };

  fetch('https://formspree.io/f/mdajnjla', {
    method:  'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  })
  .then(res => res.json().then(body => ({ ok: res.ok, body })))
  .then(({ ok, body }) => {
    if (ok && body.ok) {
      note.textContent = 'Thank you! Your message has been sent.';
      note.className   = 'form-note success';
      this.reset();
      setTimeout(() => { note.textContent = ''; note.className = 'form-note'; }, 6000);
    } else {
      const msg = body.errors?.map(err => err.message).join(', ') || body.error || 'Something went wrong.';
      note.textContent = 'Error: ' + msg;
      note.className   = 'form-note error';
    }
  })
  .catch(() => {
    note.textContent = 'Network error — please try again.';
    note.className   = 'form-note error';
  })
  .finally(() => {
    btn.disabled = false;
    const lang = document.documentElement.lang;
    btn.textContent = (lang === 'ar') ? 'إرسال الرسالة' : 'Send Message';
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

document.querySelectorAll('.img-gallery-item img').forEach(img => {
  img.addEventListener('click', () => {
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
  track.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft; });
  track.addEventListener('mouseleave', () => isDown = false);
  track.addEventListener('mouseup',    () => isDown = false);
  track.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    track.scrollLeft = scrollLeft - (e.pageX - track.offsetLeft - startX) * 1.5;
  });
}
initPhotoScroll('certsTrack',   'certsLeft',   'certsRight');
initPhotoScroll('bahrainTrack', 'bahrainLeft', 'bahrainRight');
initPhotoScroll('iraqTrack',    'iraqLeft',    'iraqRight');
initPhotoScroll('fieldTrack',   'fieldLeft',   'fieldRight');

// ── Counter animation ──
function animateCounters() {
  document.querySelectorAll('.stat-number').forEach(el => {
    const text = el.textContent;
    const num  = parseFloat(text.replace(/[^0-9.]/g, ''));
    const suffix = text.replace(/[0-9.]/g, '');
    let start = 0;
    const duration = 1600;
    const step = 16;
    const increment = num / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= num) { start = num; clearInterval(timer); }
      el.textContent = (num % 1 === 0 ? Math.floor(start) : start.toFixed(1)) + suffix;
    }, step);
  });
}

// Trigger counters when stats section enters viewport
const statsSection = document.querySelector('.stats');
let counted = false;
const observer = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !counted) {
    counted = true;
    animateCounters();
  }
}, { threshold: 0.4 });
if (statsSection) observer.observe(statsSection);

// ── Fade-in on scroll ──
const fadeEls = document.querySelectorAll(
  '.why-card, .team-card, .testimonial-card, .gallery-item, .stat-item'
);
const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.12 });

fadeEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  fadeObserver.observe(el);
});
