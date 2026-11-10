(() => {
  const $ = s => document.querySelector(s);
  const LS_STATE = 'chgk-school-state-v1', LS_BASE = 'chgk-school-base-v1';
  const TYPE_NAMES = { normal: 'Вопрос', image: 'Вопрос с картинкой', blitz: 'Блиц', blackbox: 'Чёрный ящик' };
  const SECTORS = 12;
  let BASE = null;
  let S = {
    grade: '10', team: '', target: 6, seconds: 60, tick: true,
    a: 0, b: 0, used: [], order: [], current: null, rotation: 0, inGame: false
  };
  // question runtime
  const Q = { q: null, blitzIdx: 0, total: 60, remain: 60, running: false, ended: false, last: 0, raf: 0, lastSec: null, shown: false };

  /* ---------- helpers ---------- */
  const save = () => localStorage.setItem(LS_STATE, JSON.stringify(S));
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    document.body.dataset.screen = id;
    $('#topbar').classList.toggle('visible', !['scIntro', 'scSetup'].includes(id));
  }
  function questions() { return (BASE && BASE.grades && BASE.grades[S.grade]) || []; }
  function updateScore(bump) {
    $('#sbA').textContent = S.a; $('#sbB').textContent = S.b;
    $('#sbTeam').textContent = S.team ? S.team : 'Знатоки';
    if (bump) { const el = $(bump === 'a' ? '#sbA' : '#sbB'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }

  /* ---------- base loading ---------- */
  async function loadBase() {
    const custom = localStorage.getItem(LS_BASE);
    if (custom) { try { BASE = JSON.parse(custom); return; } catch (e) { } }
    const r = await fetch('questions.json?v=3'); BASE = await r.json();
  }
  function validBase(d) { return d && d.grades && Object.values(d.grades).every(Array.isArray); }

  /* ---------- wheel ---------- */
  function polar(r, deg) { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }
  function buildWheel() {
    const svg = $('#wheel'); const qs = questions();
    let html = `<defs>
      <radialGradient id="wTable" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#1d2a4f"/><stop offset="1" stop-color="#0a1020"/></radialGradient>
      <linearGradient id="wGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc96"/><stop offset=".5" stop-color="#c9963c"/><stop offset="1" stop-color="#8a6324"/></linearGradient>
      <radialGradient id="wSec" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#16203c"/><stop offset="1" stop-color="#0e1529"/></radialGradient>
    </defs>
    <circle r="206" fill="url(#wGold)"/><circle r="198" fill="#070b16"/><circle r="194" fill="url(#wTable)"/>`;
    for (let i = 0; i < SECTORS; i++) {
      const a0 = i * 30 - 15, a1 = a0 + 30, r0 = 70, r1 = 186;
      const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
      const used = S.used.includes(i), q = qs[S.order[i]] || {};
      const [tx, ty] = polar(150, i * 30), [dx, dy] = polar(108, i * 30);
      html += `<g class="sector ${used ? 'used' : ''} ${S.current === i ? 'cur' : ''}" data-i="${i}">
        <path d="M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z"/>
        <text x="${tx}" y="${ty}" >${i + 1}</text>
        <circle class="mark ${q.type || 'normal'}" cx="${dx}" cy="${dy}" r="6"/>
      </g>`;
    }
    html += `<circle r="70" fill="none" stroke="url(#wGold)" stroke-width="2"/><circle r="186" fill="none" stroke="url(#wGold)" stroke-width="1.5" opacity=".7"/>`;
    for (let i = 0; i < 60; i++) { const [a, b] = polar(198, i * 6), [c, d] = polar(i % 5 ? 192 : 188, i * 6); html += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#c9963c" stroke-opacity=".6" stroke-width="${i % 5 ? 1 : 2}"/>`; }
    svg.innerHTML = html;
    $('#top').style.transform = `rotate(${S.rotation}deg)`;
    const left = SECTORS - S.used.length;
    $('#roundInfo').textContent = `Вопрос ${S.used.length + 1} из ${SECTORS} · ${S.grade} класс`;
    $('#boardText').textContent = left === SECTORS ? 'Стол разделён на 12 секторов. Сыгранные сектора гаснут. Игра идёт до ' + S.target + ' очков.' : `Осталось секторов: ${left}. Игра до ${S.target} очков.`;
  }
  let spinning = false;
  function spin() {
    if (spinning) return;
    const free = [...Array(SECTORS).keys()].filter(i => !S.used.includes(i));
    if (!free.length) return finish();
    spinning = true; $('#btnSpin').disabled = true;
    S.current = null; buildWheel();
    const target = free[Math.floor(Math.random() * free.length)];
    const cur = ((S.rotation % 360) + 360) % 360;
    let delta = target * 30 - cur; if (delta < 0) delta += 360;
    const jitter = (Math.random() - 0.5) * 16;
    S.rotation = S.rotation + 360 * 5 + delta + jitter;
    const dur = 4.6;
    const top = $('#top'); top.style.transition = `transform ${dur}s cubic-bezier(.15,.75,.12,1)`;
    requestAnimationFrame(() => top.style.transform = `rotate(${S.rotation}deg)`);
    SFX.spin(dur - 0.3);
    setTimeout(() => {
      S.rotation -= jitter; top.style.transition = 'transform .5s ease'; top.style.transform = `rotate(${S.rotation}deg)`;
      S.current = target; save(); buildWheel();
      SFX.tick(true);
      setTimeout(() => { spinning = false; $('#btnSpin').disabled = false; openQuestion(target); }, 1300);
    }, dur * 1000);
  }

  /* ---------- question ---------- */
  function openQuestion(sector) {
    const q = questions()[S.order[sector]];
    if (!q) { toast('В базе нет вопроса для этого сектора'); return; }
    Q.q = q; Q.blitzIdx = 0; Q.shown = false;
    $('#qSector').textContent = `Сектор ${sector + 1}`;
    $('#qType').textContent = TYPE_NAMES[q.type] || 'Вопрос';
    $('#qType').className = 'q-type ' + q.type;
    document.querySelector('.sample').style.display = q.sample ? '' : 'none';
    renderQuestionBody();
    resetTimer();
    show('scQuestion');
    if (q.type === 'blackbox') openBlackBox();
  }
  function renderQuestionBody() {
    const q = Q.q, blitz = q.type === 'blitz';
    const card = document.querySelector('.q-card'); card.classList.remove('reveal'); void card.offsetWidth; card.classList.add('reveal');
    $('#qBlitz').innerHTML = blitz ? q.items.map((_, i) => `<span class="${i < Q.blitzIdx ? 'done' : i === Q.blitzIdx ? 'on' : ''}">${i + 1}</span>`).join('') : '';
    $('#qBlitz').style.display = blitz ? '' : 'none';
    $('#qText').textContent = blitz ? q.items[Q.blitzIdx].text : q.text;
    const img = $('#qImg');
    if (q.image) { img.src = q.image; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; }
    $('#qAnswer').classList.remove('open');
    if (blitz) {
      $('#aText').innerHTML = q.items.map((it, i) => `<div>${i + 1}. ${esc(it.answer)}</div>`).join('');
    } else $('#aText').textContent = q.answer || '';
    $('#aCom').textContent = q.comment ? 'Комментарий: ' + q.comment : '';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function buildTicks() {
    let h = '';
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * Math.PI / 180, r1 = 96, r2 = i % 5 ? 92 : 89;
      h += `<line x1="${100 + r1 * Math.sin(a)}" y1="${100 - r1 * Math.cos(a)}" x2="${100 + r2 * Math.sin(a)}" y2="${100 - r2 * Math.cos(a)}" />`;
    }
    $('#tTicks').innerHTML = h;
  }
  function timerTotal() { return Q.q && Q.q.type === 'blitz' ? 20 : S.seconds; }
  function resetTimer() {
    cancelAnimationFrame(Q.raf);
    Q.total = timerTotal(); Q.remain = Q.total; Q.running = false; Q.ended = false; Q.lastSec = Q.total;
    drawTimer(); setTimerLabel(Q.q && Q.q.type === 'blitz' ? `блиц · вопрос ${Q.blitzIdx + 1} из 3` : 'минута на обсуждение');
    $('#timer').classList.remove('danger', 'running', 'ended', 'early');
    updateControls();
  }
  function setTimerLabel(t) { $('#tLbl').textContent = t; }
  function drawTimer() {
    const frac = Math.max(0, Q.remain / Q.total);
    $('#tRing').style.strokeDashoffset = (1000 * (1 - frac)).toFixed(1);
    $('#tNum').textContent = Math.ceil(Q.remain - 0.0001).toString();
    $('#timer').classList.toggle('danger', Q.remain <= 10 && Q.remain > 0 && (Q.running || Q.remain < Q.total));
  }
  function frame(t) {
    if (!Q.running) return;
    const dt = (t - Q.last) / 1000; Q.last = t;
    Q.remain = Math.max(0, Q.remain - dt);
    const sec = Math.ceil(Q.remain);
    if (sec !== Q.lastSec) {
      Q.lastSec = sec;
      if (sec === 10 && Q.total > 10) SFX.warning();
      else if (sec > 0 && (S.tick || sec < 10)) SFX.tick(sec <= 10);
    }
    drawTimer();
    if (Q.remain <= 0) return endTimer(false);
    Q.raf = requestAnimationFrame(frame);
  }
  function startPause() {
    if (Q.ended) { if (isBlitzNext()) return nextBlitz(); return; }
    if (Q.running) {
      Q.running = false; cancelAnimationFrame(Q.raf); $('#timer').classList.remove('running'); setTimerLabel('пауза'); updateControls(); return;
    }
    if (Q.remain === Q.total) SFX.horn();
    Q.running = true; Q.last = performance.now(); $('#timer').classList.add('running');
    setTimerLabel(Q.q.type === 'blitz' ? `блиц · вопрос ${Q.blitzIdx + 1} из 3` : 'время пошло');
    Q.raf = requestAnimationFrame(frame); updateControls();
  }
  function endTimer(early) {
    Q.running = false; Q.ended = true; Q.early = early; cancelAnimationFrame(Q.raf);
    const tm = $('#timer'); tm.classList.remove('running'); tm.classList.add(early ? 'early' : 'ended');
    if (early) { SFX.horn(); setTimerLabel('досрочный ответ!'); }
    else { SFX.timeUp(); Q.remain = 0; drawTimer(); $('#timer').classList.remove('danger'); setTimerLabel('время вышло — ваш ответ?'); }
    updateControls();
  }
  function early() { if (Q.running || (!Q.ended && Q.remain < Q.total)) endTimer(true); }
  const isBlitzNext = () => Q.q && Q.q.type === 'blitz' && Q.blitzIdx < Q.q.items.length - 1;
  function nextBlitz() { Q.blitzIdx++; renderQuestionBody(); resetTimer(); }
  function showAnswer() {
    if (isBlitzNext() && !Q.ended) { toast('Сначала сыграйте все три вопроса блица'); }
    Q.shown = true; $('#qAnswer').classList.add('open'); updateControls();
  }
  function updateControls() {
    const bt = $('#btnTime');
    if (Q.ended) bt.textContent = isBlitzNext() ? `Следующий вопрос блица (${Q.blitzIdx + 2}/3) →` : (Q.early ? 'Ответ принят' : 'Время вышло');
    else bt.textContent = Q.running ? 'Пауза' : (Q.remain < Q.total ? 'Продолжить' : 'Время пошло');
    bt.disabled = Q.ended && !isBlitzNext();
    $('#btnEarly').disabled = !(Q.running || (!Q.ended && Q.remain < Q.total));
    $('#scoreRow').classList.toggle('ready', Q.shown || Q.ended);
  }
  function award(side) {
    if (!Q.q || document.body.dataset.screen !== 'scQuestion') return;
    cancelAnimationFrame(Q.raf); Q.running = false;
    if (side === 'a') S.a++; else S.b++;
    if (S.current !== null && !S.used.includes(S.current)) S.used.push(S.current);
    S.current = null; save(); updateScore(side); SFX.point(side === 'a');
    toast(side === 'a' ? `Очко ${S.team ? '«' + S.team + '»' : 'знатокам'}!` : 'Очко телезрителям!');
    if (S.a >= S.target || S.b >= S.target || S.used.length >= SECTORS) setTimeout(finish, 900);
    else setTimeout(() => { buildWheel(); show('scBoard'); }, 900);
  }

  /* ---------- black box ---------- */
  function openBlackBox() {
    const bb = $('#bbox'); bb.classList.remove('open'); void bb.offsetWidth; bb.classList.add('open');
    SFX.blackBoxStart();
  }
  function closeBlackBox() {
    if (!$('#bbox').classList.contains('open')) return false;
    $('#bbox').classList.add('closing'); SFX.blackBoxStop(); SFX.gong();
    setTimeout(() => $('#bbox').classList.remove('open', 'closing'), 700);
    return true;
  }

  /* ---------- finish ---------- */
  function finish() {
    S.inGame = false; save();
    const a = S.a, b = S.b, name = S.team ? `«${S.team}»` : 'знатоки';
    $('#winTitle').textContent = a > b ? `Победили ${S.team ? 'знатоки ' + name : 'знатоки'}!` : a < b ? 'Победили телезрители!' : 'Ничья!';
    $('#winKicker').textContent = a >= b ? 'Браво, знатоки' : 'Игра окончена';
    $('#winScore').textContent = `${a} : ${b}`;
    $('#toast').classList.remove('show'); show('scWin'); SFX.victory(); confetti();
  }
  function confetti() {
    const c = $('#confetti'), x = c.getContext('2d'); const W = c.width = innerWidth, H = c.height = innerHeight;
    const P = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: -Math.random() * H, r: 3 + Math.random() * 5, v: 1 + Math.random() * 2.5, w: Math.random() * 6, c: ['#f6dc96', '#c9963c', '#fff1c7', '#a8792e'][Math.floor(Math.random() * 4)] }));
    let n = 0;
    (function loop() {
      x.clearRect(0, 0, W, H);
      P.forEach(p => { p.y += p.v; p.x += Math.sin((p.y + p.w * 40) / 40); x.fillStyle = p.c; x.globalAlpha = .85; x.beginPath(); x.ellipse(p.x, p.y, p.r, p.r * .45, p.y / 30, 0, 7); x.fill(); if (p.y > H) p.y = -10; });
      if (++n < 600 && document.body.dataset.screen === 'scWin') requestAnimationFrame(loop); else x.clearRect(0, 0, W, H);
    })();
  }

  /* ---------- setup ---------- */
  function renderSetup() {
    document.querySelectorAll('#segGrade button').forEach(b => b.classList.toggle('on', b.dataset.v === S.grade));
    $('#inTeam').value = S.team; $('#tVal').textContent = S.target; $('#sVal').textContent = S.seconds; $('#chkTick').checked = S.tick;
  }
  function newGame() {
    S.team = $('#inTeam').value.trim(); S.tick = $('#chkTick').checked;
    const n = questions().length;
    if (n < 1) { toast('Для этого класса нет вопросов'); return; }
    const idx = shuffle([...Array(n).keys()]);
    S.order = Array.from({ length: SECTORS }, (_, i) => idx[i % n]);
    S.a = 0; S.b = 0; S.used = []; S.current = null; S.inGame = true; save();
    updateScore(); buildWheel(); show('scBoard'); SFX.gong();
  }

  /* ---------- wiring ---------- */
  function fullscreen() {
    const d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen || (() => toast('Полноэкранный режим недоступен'))).call(d.documentElement);
    else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  }
  function wire() {
    $('#btnStart').onclick = () => {
      SFX.unlock(); SFX.gong();
      const intro = document.querySelector('.intro'); intro.classList.add('leaving');
      setTimeout(() => { intro.classList.remove('leaving'); renderSetup(); show('scSetup'); }, 900);
    };
    document.querySelectorAll('#segGrade button').forEach(b => b.onclick = () => { S.grade = b.dataset.v; renderSetup(); SFX.tick(false); });
    $('#tDown').onclick = () => { S.target = Math.max(1, S.target - 1); renderSetup(); };
    $('#tUp').onclick = () => { S.target = Math.min(12, S.target + 1); renderSetup(); };
    $('#sDown').onclick = () => { S.seconds = Math.max(20, S.seconds - 10); renderSetup(); };
    $('#sUp').onclick = () => { S.seconds = Math.min(180, S.seconds + 10); renderSetup(); };
    $('#btnGo').onclick = newGame;
    $('#inBase').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const d = JSON.parse(await f.text()); if (!validBase(d)) throw 0; BASE = d; localStorage.setItem(LS_BASE, JSON.stringify(d)); toast('База загружена: ' + Object.entries(d.grades).map(([g, a]) => `${g} кл. — ${a.length}`).join(', ')); }
      catch (_) { toast('Не получилось прочитать файл. Нужен формат как в questions.json'); }
    };
    $('#btnSpin').onclick = spin;
    $('#btnTime').onclick = startPause;
    $('#btnEarly').onclick = early;
    $('#btnReset').onclick = resetTimer;
    $('#btnShow').onclick = showAnswer;
    $('#btnA').onclick = () => award('a');
    $('#btnB').onclick = () => award('b');
    $('#btnBbOpen').onclick = closeBlackBox;
    $('#btnAgain').onclick = () => { renderSetup(); show('scSetup'); };
    $('#btnHome').onclick = () => {
      if (document.body.dataset.screen === 'scQuestion') { cancelAnimationFrame(Q.raf); Q.running = false; closeBlackBox(); show('scBoard'); buildWheel(); return; }
      if (confirm('Вернуться к настройкам? Счёт текущей игры сохранится до начала новой.')) { renderSetup(); show('scSetup'); }
    };
    $('#btnMute').onclick = () => { SFX.setMuted(!SFX.isMuted()); $('#btnMute').textContent = SFX.isMuted() ? '🔇' : '🔊'; };
    $('#btnFs').onclick = fullscreen;
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const sc = document.body.dataset.screen, k = e.key.toLowerCase();
      if (k === 'f' || k === 'а') return fullscreen();
      if (k === 'm' || k === 'ь') return $('#btnMute').click();
      if (sc === 'scIntro' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return $('#btnStart').click(); }
      if (sc === 'scBoard' && (k === 's' || k === 'ы' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); return spin(); }
      if (sc === 'scQuestion') {
        if ($('#bbox').classList.contains('open')) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeBlackBox(); } return; }
        if (e.key === ' ') { e.preventDefault(); startPause(); }
        else if (e.key === 'Enter') { e.preventDefault(); showAnswer(); }
        else if (k === 'd' || k === 'в') early();
        else if (k === 'r' || k === 'к') resetTimer();
        else if (k === 'n' || k === 'т') { if (Q.ended && isBlitzNext()) nextBlitz(); }
        else if (e.key === '1') award('a');
        else if (e.key === '2') award('b');
      }
    });
  }

  /* ---------- boot ---------- */
  (async function boot() {
    try { const s = JSON.parse(localStorage.getItem(LS_STATE) || 'null'); if (s) S = Object.assign(S, s); } catch (_) { }
    await loadBase();
    buildTicks(); wire(); updateScore(); show('scIntro');
    if (S.inGame && S.order.length) {
      const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = `Продолжить игру (${S.a} : ${S.b})`;
      b.onclick = () => { SFX.unlock(); SFX.gong(); buildWheel(); show('scBoard'); };
      $('#btnStart').after(b);
    }
    // debug hooks for screenshots
    window.__chgk = { S, Q, openQuestion: i => openQuestion(i), newGame, startPause, showAnswer, buildWheel, show };
  })();
})();
