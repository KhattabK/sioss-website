/* Learner area: sign-in, paid-access check, lessons, quizzes, final exam.
   Lesson content lives in Supabase behind RLS (see supabase/course-schema.sql), never in this repository. */
(() => {
  const C = SIOSS_COURSE, EXAM = 99;
  const app = document.getElementById('app');
  const $ = (sel, root = document) => root.querySelector(sel);
  const wa = text => 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent(text);

  // ── Backends ──────────────────────────────────────────────────────────────
  const live = {
    async user() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    sendLink: email => sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }),
    verify: (email, token) => sb.auth.verifyOtp({ email, token, type: 'email' }),
    signOut: () => sb.auth.signOut(),
    async outline() {
      const { data } = await sb.from('course_units').select('n,kind,section,title,meta').eq('course', C.id).order('n');
      return data || [];
    },
    async lesson(n) {
      const { data } = await sb.from('course_units').select('n,kind,title,video_url,html').eq('course', C.id).eq('n', n).maybeSingle();
      return data;
    },
    async progress() {
      const { data } = await sb.from('course_progress').select('n,score').eq('course', C.id);
      return Object.fromEntries((data || []).map(r => [r.n, r.score]));
    },
    async savePass(n, score, uid) {
      await sb.from('course_progress').upsert({ user_id: uid, course: C.id, n, score, passed_at: new Date().toISOString() });
    },
    async cert() {
      const { data } = await sb.from('course_certificates').select('cert_no,name,issued_at').eq('course', C.id).maybeSingle();
      return data;
    },
    async submitExam(answers, name) {
      const { data, error } = await sb.rpc('submit_final_exam', { p_course: C.id, p_answers: answers, p_name: name });
      return error ? { error: error.message } : data;
    }
  };

  // Local preview only: http://localhost…/course/?demo  (content file is git-ignored and never deployed)
  const store = k => JSON.parse(localStorage.getItem('ffc-demo-' + k) || 'null');
  const put = (k, v) => localStorage.setItem('ffc-demo-' + k, JSON.stringify(v));
  let demoData;
  const demo = {
    async user() { demoData = await (await fetch('../.claude/course-demo/content.json')).json(); return { id: 'demo', email: 'معاينة' }; },
    signOut: async () => { ['progress', 'cert'].forEach(k => localStorage.removeItem('ffc-demo-' + k)); },
    outline: async () => demoData.units,
    lesson: async n => demoData.units.find(u => u.n === n),
    progress: async () => store('progress') || {},
    async savePass(n, score) { put('progress', { ...(store('progress') || {}), [n]: score }); },
    cert: async () => store('cert'),
    async submitExam(answers, name) {
      const score = answers.filter((a, i) => a === demoData.key[i]).length, passed = score >= demoData.pass;
      if (passed && !store('cert')) put('cert', { cert_no: 'SIOSS-FFC-DEMO-0001', name, issued_at: new Date().toISOString().slice(0, 10) });
      return { score, total: demoData.key.length, pass: demoData.pass, passed, cert_no: passed ? store('cert').cert_no : null };
    }
  };

  const isDemo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]demo\b/.test(location.search);
  const api = isDemo ? demo : live;
  let user = null, units = [], progress = {}, cert = null;

  // ── Views ─────────────────────────────────────────────────────────────────
  function viewLogin() {
    app.innerHTML = `
      <section class="card narrow">
        <h1>دخول المتدربين</h1>
        <p class="muted">اكتب بريدك الإلكتروني، ونرسل إليك رابط الدخول. لا تحتاج كلمة مرور.</p>
        <form id="f">
          <label for="email">البريد الإلكتروني</label>
          <input id="email" type="email" dir="ltr" required autocomplete="email" placeholder="name@example.com">
          <button class="btn" id="send">أرسل رابط الدخول</button>
        </form>
        <form id="c" hidden>
          <p class="ok-msg">أرسلنا الرسالة. افتح الرابط الذي فيها من هذا الجهاز، أو اكتب الرمز هنا.</p>
          <label for="code">رمز الدخول</label>
          <input id="code" inputmode="numeric" dir="ltr" autocomplete="one-time-code" maxlength="8" required>
          <button class="btn">دخول</button>
        </form>
        <p class="err" id="e" role="alert"></p>
        <p class="muted small">لم تشترك بعد؟ <a href="../football-fitness-course.html">تعرّف على الدورة</a></p>
      </section>`;
    let email = '';
    $('#f').onsubmit = async ev => {
      ev.preventDefault();
      email = $('#email').value.trim().toLowerCase();
      $('#send').disabled = true; $('#e').textContent = '';
      const { error } = await api.sendLink(email);
      $('#send').disabled = false;
      if (error) { $('#e').textContent = 'تعذّر إرسال الرسالة. حاول بعد دقيقة.'; return; }
      $('#c').hidden = false; $('#code').focus();
    };
    $('#c').onsubmit = async ev => {
      ev.preventDefault();
      const { error } = await api.verify(email, $('#code').value.trim());
      if (error) $('#e').textContent = 'الرمز غير صحيح أو انتهت صلاحيته.'; else start();
    };
  }

  function viewLocked() {
    const justPaid = /[?&]paid\b/.test(location.search);
    const pay = C.stripeLink
      ? `<a class="btn" href="${C.stripeLink}${C.stripeLink.includes('?') ? '&' : '?'}client_reference_id=${user.id}">ادفع الآن وابدأ الدورة</a>`
      : `<a class="btn" target="_blank" rel="noopener" href="${wa('أرغب بالاشتراك في ' + C.title)}">اشترك عبر واتساب</a>`;
    app.innerHTML = `
      <section class="card narrow">
        <h1>${justPaid ? 'نفعّل اشتراكك الآن…' : 'خطوة أخيرة: أكمل اشتراكك'}</h1>
        <p class="muted">${justPaid
          ? 'وصلنا الدفع. يستغرق التفعيل ثوانيَ قليلة، وتُفتح الدورة تلقائياً.'
          : `سجّلت الدخول بنجاح. ادفع رسوم الدورة${C.priceText ? ' (' + C.priceText + ')' : ''} لتُفتح لك الوحدات كلها فوراً.`}</p>
        ${justPaid ? '' : pay}
        <button class="btn ghost" id="again" type="button">دفعتُ للتو، حدّث</button>
        <p class="muted small">إن دفعت ببريد مختلف فسجّل الدخول به، أو راسلنا على واتساب.</p>
      </section>`;
    $('#again').onclick = start;
    if (justPaid) {  // the Stripe webhook may land a few seconds after the redirect
      let tries = 0;
      const t = setInterval(async () => {
        units = await api.outline();
        if (units.length || ++tries > 10) { clearInterval(t); if (units.length) { history.replaceState(null, '', location.pathname); start(); } }
      }, 3000);
    }
  }

  const lessons = () => units.filter(u => u.kind === 'unit');
  const allDone = () => lessons().every(u => u.n in progress);

  function viewHome() {
    const ls = lessons(), done = ls.filter(u => u.n in progress).length;
    const next = ls.find(u => !(u.n in progress));
    const sections = [...new Set(ls.map(u => u.section))];
    app.innerHTML = `
      <section class="hero">
        <h1>${C.title}</h1>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${ls.length}" aria-valuenow="${done}"><i style="width:${done / ls.length * 100}%"></i></div>
        <p class="muted">أكملت ${done} من ${ls.length} وحدة.</p>
        ${cert ? `<a class="btn" href="certificate.html${location.search}">شهادتك جاهزة: افتحها</a>`
          : next ? `<a class="btn" href="#/unit/${next.n}">${done ? 'تابع' : 'ابدأ'}: الوحدة ${next.n}</a>`
          : `<a class="btn" href="#/exam">انتقل إلى الاختبار النهائي</a>`}
      </section>
      <section class="how">
        <b>طريقة الدراسة:</b> شاهد فيديو الوحدة، ثم اقرأ النص، ثم أجب عن اختبارها. تُحسب الوحدة مكتملة عند النجاح في اختبارها.
      </section>
      ${sections.map(s => `
        <h2>${s}</h2>
        <div class="list">${ls.filter(u => u.section === s).map(u => `
          <a class="row ${u.n in progress ? 'done' : ''}" href="#/unit/${u.n}">
            <span class="num">${u.n in progress ? '✓' : u.n}</span>
            <span class="t"><b>${u.title.replace(/^الوحدة \d+:\s*/, '')}</b><small>${u.meta}</small></span>
          </a>`).join('')}
        </div>`).join('')}
      <h2>الاختبار النهائي والشهادة</h2>
      <div class="list">
        <a class="row ${cert ? 'done' : ''} ${allDone() ? '' : 'off'}" ${allDone() ? 'href="#/exam"' : 'aria-disabled="true"'}>
          <span class="num">${cert ? '✓' : '★'}</span>
          <span class="t"><b>الاختبار النهائي</b><small>${allDone() ? '30 سؤالاً · النجاح فيه شرط الشهادة' : 'يُفتح بعد إكمال الوحدات الثلاث عشرة'}</small></span>
        </a>
      </div>`;
  }

  async function viewLesson(n) {
    app.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
    const u = await api.lesson(n);
    if (!u) { location.hash = '#/'; return; }
    const isExam = u.kind === 'exam';
    if (isExam && !allDone()) { location.hash = '#/'; return; }
    const ls = lessons(), i = ls.findIndex(x => x.n === n);
    const prev = ls[i - 1], next = ls[i + 1];
    app.innerHTML = `
      <p><a href="#/">→ كل الوحدات</a></p>
      <article class="unit">${u.html}</article>
      <nav class="pn">
        ${!isExam && prev ? `<a href="#/unit/${prev.n}">→ الوحدة ${prev.n}</a>` : '<span></span>'}
        ${isExam ? '' : next ? `<a href="#/unit/${next.n}">الوحدة ${next.n} ←</a>` : `<a href="#/exam">الاختبار النهائي ←</a>`}
      </nav>`;
    if (!isExam && n <= 9) {
      const box = document.createElement('div');
      box.className = 'video';
      const yt = (u.video_url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
      box.innerHTML = yt
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1" title="فيديو الوحدة ${n}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
        : u.video_url && !isDemo
        ? `<video controls playsinline preload="metadata" controlslist="nodownload" src="${u.video_url}"></video>`
        : `<div class="ph">فيديو الوحدة ${n} يظهر هنا بعد رفعه</div>`;
      $('.unit header').after(box);
    }
    quiz($('.unit'), u, isExam);
    scrollTo(0, 0);
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  function quiz(root, u, isExam) {
    const qs = [...root.querySelectorAll('.q')];
    if (!qs.length) return;
    const note = qs[0].previousElementSibling;
    const m = note.textContent.match(/درجة النجاح\s*(\d+)\s*من\s*(\d+)/);
    const pass = m ? +m[1] : Math.ceil(qs.length * 0.7);
    note.textContent = `اختر إجابة واحدة لكل سؤال ثم اضغط «${isExam ? 'أرسل الاختبار' : 'تحقّق من إجاباتي'}». درجة النجاح ${pass} من ${qs.length}.`;

    let locked = false;
    qs.forEach(q => {
      const lis = [...q.querySelectorAll('li')];
      q.querySelector('ul').setAttribute('role', 'radiogroup');
      lis.forEach(li => {
        li.setAttribute('role', 'radio'); li.setAttribute('aria-checked', 'false'); li.tabIndex = 0;
        const pick = () => {
          if (locked) return;
          lis.forEach(x => { x.classList.remove('picked'); x.setAttribute('aria-checked', 'false'); });
          li.classList.add('picked'); li.setAttribute('aria-checked', 'true'); q.classList.remove('missing');
        };
        li.onclick = pick;
        li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
      });
    });

    const bar = document.createElement('div');
    bar.className = 'quiz-bar';
    bar.innerHTML = (isExam && !cert ? `
        <div class="name-box">
          <b>⚠ اسمك في الشهادة</b>
          <p>اكتب اسمك <strong>الكامل</strong> (الاسم الأول واسم الأب واسم العائلة) <strong>بالأحرف الإنجليزية</strong>، مضبوطاً كما في جواز السفر. سيُطبع في الشهادة كما تكتبه تماماً، <strong>ولا يمكن تغييره بعد صدورها</strong>.</p>
          <label for="certName">الاسم بالإنجليزية</label>
          <input id="certName" dir="ltr" autocomplete="name" placeholder="e.g. Ahmed Ali Hassan">
          <p class="preview" id="namePreview" dir="ltr" hidden></p>
          <label class="check"><input type="checkbox" id="nameOk"> راجعتُ اسمي، وهو مكتوب صحيحاً</label>
        </div>` : '') +
      `<button class="btn" type="button">${isExam ? 'أرسل الاختبار' : 'تحقّق من إجاباتي'}</button>
       <p class="quiz-result" role="status"></p>`;
    qs[qs.length - 1].after(bar);
    const btn = $('button.btn', bar), out = $('.quiz-result', bar);
    const tidy = s => s.trim().replace(/\s+/g, ' ');
    if ($('#certName', bar)) {
      $('#certName', bar).oninput = e => {
        const v = tidy(e.target.value), pv = $('#namePreview', bar);
        pv.hidden = !v; pv.textContent = 'In the certificate: ' + v;
        $('#nameOk', bar).checked = false;
      };
    }

    btn.onclick = async () => {
      if (locked) { viewLesson(u.n); return; }
      const open = qs.filter(q => !q.querySelector('.picked'));
      if (open.length) {
        open.forEach(q => q.classList.add('missing'));
        out.className = 'quiz-result'; out.textContent = `بقي ${open.length} من الأسئلة بلا إجابة.`;
        open[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const picks = qs.map(q => [...q.querySelectorAll('li')].findIndex(li => li.classList.contains('picked')));

      if (isExam) {
        const name = cert ? cert.name : tidy($('#certName').value);
        if (!cert && !/^[A-Za-z][A-Za-z.'-]*( [A-Za-z][A-Za-z.'-]*)+$/.test(name)) {
          out.className = 'quiz-result fail'; out.textContent = 'اكتب اسمك الكامل (كلمتان على الأقل) بالأحرف الإنجليزية فقط.'; $('#certName').focus(); return;
        }
        if (!cert && !$('#nameOk').checked) {
          out.className = 'quiz-result fail'; out.textContent = 'راجع اسمك ثم ضع علامة على «راجعتُ اسمي».'; $('#nameOk').focus(); return;
        }
        btn.disabled = true;
        const r = await api.submitExam(picks, name);
        btn.disabled = false;
        if (!r || r.error) {
          out.className = 'quiz-result fail';
          out.textContent = r && r.error === 'too_many_attempts' ? 'استنفدت ثلاث محاولات اليوم. راجع الوحدات وحاول غداً.' : 'تعذّر إرسال الاختبار. حاول مرة أخرى.';
          return;
        }
        locked = true; root.classList.add('quiz-done');
        out.className = 'quiz-result ' + (r.passed ? 'pass' : 'fail');
        if (r.passed) {
          cert = await api.cert();
          out.innerHTML = `نتيجتك: ${r.score} من ${r.total}. مبارك، نجحت. <a class="btn" href="certificate.html${location.search}">افتح شهادتك</a>`;
          btn.hidden = true;
        } else {
          out.textContent = `نتيجتك: ${r.score} من ${r.total}. درجة النجاح ${r.pass}. راجع الوحدات ثم أعد المحاولة.`;
          btn.textContent = 'أعد المحاولة';
        }
        return;
      }

      let score = 0;
      qs.forEach(q => { const right = q.querySelector('.picked').classList.contains('ok'); if (right) score++; q.classList.add(right ? 'right' : 'wrong'); });
      locked = true; root.classList.add('quiz-done');
      const ok = score >= pass;
      out.className = 'quiz-result ' + (ok ? 'pass' : 'fail');
      out.textContent = `نتيجتك: ${score} من ${qs.length}. ` + (ok ? 'ناجح. أحسنت، الوحدة مكتملة.' : `لم تبلغ درجة النجاح (${pass}). راجع الوحدة ثم أعد المحاولة.`);
      btn.textContent = 'أعد المحاولة';
      if (ok) { progress[u.n] = Math.max(score, progress[u.n] || 0); await api.savePass(u.n, score, user.id); }
    };
  }

  // ── Router ────────────────────────────────────────────────────────────────
  function route() {
    if (!user) return viewLogin();
    if (!units.length) return viewLocked();
    const m = location.hash.match(/^#\/unit\/(\d+)$/);
    if (m) return viewLesson(+m[1]);
    if (location.hash === '#/exam') return viewLesson(EXAM);
    viewHome(); scrollTo(0, 0);
  }

  async function start() {
    user = await api.user();
    $('#who').hidden = !user;
    if (user) {
      $('#whoEmail').textContent = user.email;
      [units, progress, cert] = await Promise.all([api.outline(), api.progress(), api.cert()]);
    }
    route();
  }

  $('#courseTitle').textContent = C.title;
  $('#demoBar').hidden = !isDemo;
  $('#waHelp').href = wa('أحتاج مساعدة في ' + C.title);
  $('#signOut').textContent = isDemo ? 'امسح تقدّم المعاينة' : 'خروج';
  $('#signOut').onclick = async () => { await api.signOut(); location.hash = ''; location.reload(); };
  addEventListener('hashchange', route);
  if (!isDemo) sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN' && !user) start(); });
  start();
})();
