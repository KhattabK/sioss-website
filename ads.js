/* Ad pixels (Meta, TikTok, Snapchat) behind a cookie-consent banner.
   ضع أرقام البكسل هنا فقط. ما دامت كلها فارغة فلا يظهر بانر ولا يُحمَّل أي شيء.
   Events: PageView on every page, ViewContent on a course's sales page,
   InitiateCheckout on any pay/enrol click, Purchase when Stripe returns the
   buyer (learner area with ?paid, or the PE diploma thanks page).
   Test on any host with ?adsdebug: shows the banner and logs events to the
   console without loading the pixels. */
(function () {
  var IDS = {
    meta: '',    // Meta Pixel ID (أرقام فقط)
    tiktok: 'DBBRA4BC77UF91060LSG',  // TikTok Pixel ID
    snap: 'd3d6d8b4-97f5-4f52-b6e9-274ccea42334'     // Snap Pixel ID
  };

  var debug = /[?&]adsdebug\b/.test(location.search);
  var live = /(^|\.)sioss\.se$/.test(location.hostname);
  if (!debug && (!live || !(IDS.meta || IDS.tiktok || IDS.snap))) return;

  var KEY = 'sioss_ads_consent';
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Course for this page: id, price in USD, and whether it is the sales page.
  var COURSES = [
    { id: 'cpr', value: 99, sales: 'first-aid-cpr-course', area: 'cpr' },
    { id: 'ffc', value: 149, sales: 'football-fitness-course', area: 'course' },
    { id: 'tac', value: 149, sales: 'football-tactics-course', area: 'tactics' },
    { id: 'hrv', value: 199, sales: 'hrv-coach-course', area: 'hrv' },
    { id: 'ptd', value: 449, sales: 'personal-trainer-diploma', area: 'pt' },
    { id: 'pe', value: 499, sales: 'pe-teacher-diploma', area: null }
  ];
  var path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  var page = null;
  COURSES.forEach(function (c) {
    if (path === '/' + c.sales) page = { course: c, kind: 'sales' };
    else if (c.area && path.indexOf('/' + c.area + '/') === 0) page = { course: c, kind: 'area' };
    else if (c.id === 'pe' && path === '/pe-teacher-diploma-thanks') page = { course: c, kind: 'thanks' };
  });

  var NAMES = {  // standard event names per platform
    PageView: { meta: 'PageView', tiktok: null, snap: 'PAGE_VIEW' },
    ViewContent: { meta: 'ViewContent', tiktok: 'ViewContent', snap: 'VIEW_CONTENT' },
    InitiateCheckout: { meta: 'InitiateCheckout', tiktok: 'InitiateCheckout', snap: 'START_CHECKOUT' },
    Purchase: { meta: 'Purchase', tiktok: 'CompletePayment', snap: 'PURCHASE' }
  };

  function track(name) {
    var c = name !== 'PageView' && page && page.course;
    var data = c ? { content_ids: [c.id], content_type: 'product', value: c.value, currency: 'USD' } : {};
    var n = NAMES[name];
    if (debug) { console.log('[ads]', name, data); return; }
    if (IDS.meta && window.fbq && n.meta) window.fbq('track', n.meta, data);
    if (IDS.tiktok && window.ttq && n.tiktok) window.ttq.track(n.tiktok, c ? { contents: [{ content_id: c.id }], value: c.value, currency: 'USD' } : {});
    if (IDS.snap && window.snaptr && n.snap) window.snaptr('track', n.snap, c ? { item_ids: [c.id], price: c.value, currency: 'USD' } : {});
  }

  function loadPixels() {
    if (debug) return;
    /* eslint-disable */
    if (IDS.meta) {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', IDS.meta);
    }
    if (IDS.tiktok) {
      !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)}}(window,document,'ttq');
      window.ttq.load(IDS.tiktok);
      window.ttq.page();
    }
    if (IDS.snap) {
      (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');
      window.snaptr('init', IDS.snap, {});
    }
    /* eslint-enable */
  }

  function start() {
    loadPixels();
    track('PageView');
    if (!page) return;
    if (page.kind === 'sales') track('ViewContent');
    var paid = page.kind === 'thanks' || (page.kind === 'area' && /[?&]paid\b/.test(location.search));
    // Count a purchase once per tab, so a refresh while the course unlocks is not a second sale.
    if (paid) {
      var once = 'sioss_purchase_' + page.course.id, seen = false;
      try { seen = sessionStorage.getItem(once) === '1'; sessionStorage.setItem(once, '1'); } catch (e) {}
      if (!seen) track('Purchase');
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && (a.id === 'buyBtn' || /buy\.stripe\.com/.test(a.href))) track('InitiateCheckout');
    }, true);
  }

  function banner() {
    var box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'ملفات تعريف الارتباط');
    box.dir = 'rtl';
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;max-width:560px;margin:0 auto;' +
      'background:#0a1426;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:16px 18px;' +
      'box-shadow:0 10px 40px rgba(0,0,0,.4);font:15px/1.7 Cairo,Tahoma,sans-serif';
    box.innerHTML =
      '<p style="margin:0 0 12px">نستخدم ملفات تعريف الارتباط من ميتا وتيك توك وسناب شات لقياس إعلاناتنا، ' +
      'ولا نفعّلها إلا بموافقتك. <a href="/privacy.html" style="color:#4fc3f7">سياسة الخصوصية</a></p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" data-v="yes" style="flex:1;min-width:120px;padding:10px;border:0;border-radius:10px;background:#f4b942;color:#0a1426;font:700 15px Cairo,Tahoma,sans-serif;cursor:pointer">أوافق</button>' +
      '<button type="button" data-v="no" style="flex:1;min-width:120px;padding:10px;border:1px solid rgba(255,255,255,.4);border-radius:10px;background:transparent;color:#fff;font:700 15px Cairo,Tahoma,sans-serif;cursor:pointer">لا أوافق</button>' +
      '</div>';
    box.addEventListener('click', function (e) {
      var v = e.target.getAttribute && e.target.getAttribute('data-v');
      if (!v) return;
      save(KEY, v);
      box.remove();
      if (v === 'yes') start();
    });
    document.body.appendChild(box);
  }

  // The privacy page links back here so a visitor can change their answer.
  window.siossAdsReset = function () { save(KEY, ''); location.reload(); };

  var choice = load(KEY);
  function init() { if (choice === 'yes') start(); else if (choice !== 'no') banner(); }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
