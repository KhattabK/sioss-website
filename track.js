/* Cookieless visit counter: logs the page, where the visitor came from and pay-button clicks
   to the course Supabase project (table page_views, insert-only; see supabase/analytics.sql). */
(function () {
  if (!/(^|\.)sioss\.se$/.test(location.hostname)) return;
  var ENDPOINT = 'https://pawvtskgquzydpppjbcd.supabase.co/rest/v1/page_views';
  var KEY = 'sb_publishable_-d2JAm4vNQlq3uONGG_ivA_v6TyZFNV';
  var q = new URLSearchParams(location.search);
  var ref = '';
  try { var r = new URL(document.referrer); if (r.hostname !== location.hostname) ref = r.hostname; } catch (e) {}
  function cut(v, n) { return v ? String(v).slice(0, n) : null; }
  // The first page of a visit (per browser tab) is marked, so the public counter counts visits, not page views.
  // A sessionStorage flag only: no identifier is stored and nothing follows the visitor.
  var entry = false;
  try { if (!sessionStorage.getItem('sioss:visit')) { sessionStorage.setItem('sioss:visit', '1'); entry = true; } } catch (e) {}
  function send(event) {
    try {
      fetch(ENDPOINT, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          event: event,
          path: cut(location.pathname, 200),
          referrer: cut(ref, 120),
          utm_source: cut(q.get('utm_source'), 60),
          utm_campaign: cut(q.get('utm_campaign'), 60),
          lang: cut(q.get('lang') || document.documentElement.lang, 10),
          device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          entry: event === 'view' && entry
        })
      }).catch(function () {});
    } catch (e) {}
  }
  // Wait for i18n.js to set the page language, so the language shown is the one recorded.
  // A deferred script runs while readyState is already 'interactive' but before DOMContentLoaded,
  // i.e. before i18n.js has applied the language, so wait for the event unless the page has fully loaded.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', function () { send('view'); });
  else send('view');
  // Public visitor counter on the home page (#visitCount): today's visits (Baghdad time) and all visits.
  var box = document.getElementById('visitCount');
  if (box) {
    fetch('https://pawvtskgquzydpppjbcd.supabase.co/rest/v1/rpc/visitor_count', {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}'
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || typeof d.total !== 'number') return;
      var fmt = function (n) { return Number(n).toLocaleString('en-US'); };
      var draw = function () {
        var ar = document.documentElement.lang !== 'en';
        document.getElementById('visitText').textContent = ar
          ? 'زوار اليوم ' + fmt(d.today) + ' · إجمالي الزوار ' + fmt(d.total)
          : fmt(d.today) + (d.today === 1 ? ' visitor today · ' : ' visitors today · ') + fmt(d.total) + ' in total';
        box.style.display = '';
      };
      draw();
      new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (a && (a.id === 'buyBtn' || /buy\.stripe\.com/.test(a.href))) send('buy_click');
  }, true);
})();
