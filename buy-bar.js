/* Course sales pages: the price and both ways to pay on the first screen, plus a buy bar that stays at the
   bottom of the phone screen once the visitor scrolls past them (hidden again at the #buy section).
   Reads SIOSS_COURSE from the course's config.js; the learner-area link comes from #buyBtn. */
(function () {
  // config.js declares it with const, so it is a global binding but not a property of window.
  var C = typeof SIOSS_COURSE !== 'undefined' ? SIOSS_COURSE : null;
  if (!C) return;
  var price = C.priceText || '';
  var wa = 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent(
    'السلام عليكم، أرغب بالاشتراك في ' + C.title + (price ? ' (' + price + ')' : '') + ' وأريد الدفع بزين كاش أو كي كارد.');
  var buyHref = (document.getElementById('buyBtn') || {}).href || '#buy';

  var amt = document.getElementById('heroAmt');
  if (amt) amt.textContent = price || 'السعر يُعلن قريباً';
  var heroBuy = document.getElementById('heroBuy');
  if (heroBuy) {
    heroBuy.href = buyHref;
    heroBuy.textContent = price ? 'اشترك الآن · ' + price : 'اشترك الآن';
  }
  var heroWa = document.getElementById('heroWa');
  if (heroWa) heroWa.href = wa;

  var css = document.createElement('style');
  css.textContent =
    '.buybar{position:fixed;left:0;right:0;bottom:0;z-index:900;display:flex;align-items:center;gap:8px;' +
    'padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(10,14,21,.94);' +
    'border-top:1px solid var(--border);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
    'transform:translateY(110%);transition:transform .25s ease}' +
    '.buybar.on{transform:none}' +
    '.buybar b{font-size:20px;color:#fff;white-space:nowrap}' +
    '.buybar .btn{flex:1;padding:11px 10px;text-align:center;font-size:15px}' +
    '.buybar .btn.wa:not(.ghost){background:#1fa855;box-shadow:none}' +
    '.buybar .wa{flex:0 0 auto;width:46px;height:46px;padding:0;display:grid;place-items:center;border-radius:999px}' +
    '@media (min-width:761px){.buybar{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.buybar{transition:none}}';
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.className = 'buybar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'الاشتراك في الدورة');
  bar.innerHTML =
    '<b dir="ltr"></b>' +
    '<a class="btn" data-buy></a>' +
    '<a class="btn wa" data-buy target="_blank" rel="noopener" aria-label="ادفع بزين كاش أو كي كارد عبر واتساب">' +
    '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg></a>';
  bar.querySelector('b').textContent = price;
  var barBuy = bar.querySelector('.btn:not(.wa)');
  barBuy.href = buyHref;
  barBuy.textContent = 'اشترك الآن';
  bar.querySelector('.wa').href = wa;
  document.body.appendChild(bar);

  // Shown after the first-screen buttons leave the view, hidden while the #buy box itself is visible.
  var heroGone = false, buyVisible = false;
  function draw() { bar.classList.toggle('on', heroGone && !buyVisible); }
  if ('IntersectionObserver' in window) {
    var row = document.querySelector('.hero-buy');
    var box = document.getElementById('buy');
    if (row) new IntersectionObserver(function (e) { heroGone = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; draw(); }).observe(row);
    if (box) new IntersectionObserver(function (e) { buyVisible = e[0].isIntersecting; draw(); }).observe(box);
  }
})();
