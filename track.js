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
          device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        })
      }).catch(function () {});
    } catch (e) {}
  }
  send('view');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (a && (a.id === 'buyBtn' || /buy\.stripe\.com/.test(a.href))) send('buy_click');
  }, true);
})();
