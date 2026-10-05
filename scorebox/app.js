(function () {
  'use strict';
  var E = window.Engine, SEC = E.SEC, CONSOLES = window.Consoles;
  var ORDER = ['fairplay', 'nevco'];

  /* ---------- storage (per-viewer conveniences only) ---------- */
  function load(k, d) { try { var v = localStorage.getItem('sbt.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('sbt.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

  var cfg = Object.assign(E.defaultSettings(), { periodLen: 900, minor: 90, tenths: true }, load('cfg', {}));
  cfg.pen3 = 90;
  var consoleId = CONSOLES[load('console', 'fairplay')] ? load('console', 'fairplay') : 'fairplay';
  var META = CONSOLES[consoleId], CU = null;          // console metadata, and its built UI module
  var sim = null;
  var tab = 'start';
  var explain = false;
  var showHints = load('hints', true);
  var drillHints = load('drillHints', false);
  var soundOn = load('sound', true);
  var doneLessons = {};
  var LESSONS = [], DRILLS = [];
  var lesson = null, drill = null, explainKey = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function fmt(sec) { return E.fmt(sec * SEC); }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pickPlayers(n) {
    var out = [];
    while (out.length < n) { var p = rnd(2, 29); if (out.indexOf(p) < 0) out.push(p); }
    return out;
  }
  function minorStr() { return fmt(cfg.minor); }
  function numKeys(n) { return String(n).split('').map(function (d) { return 'd' + d; }); }
  function val(x) { return typeof x === 'function' ? x() : x; }
  function newGame() { return E.newGame(cfg, consoleId); }
  function teamName(T) { return T === 'H' ? 'Home' : META.teams.V.charAt(0) + META.teams.V.slice(1).toLowerCase(); }

  /* ---------- shared helpers handed to each console module ---------- */
  function midGame(s, o) {
    o = o || {};
    s.period = o.period || 1;
    s.clock = (o.clock != null ? o.clock : cfg.periodLen - 187) * SEC;
    s.H.score = o.h || 0; s.V.score = o.v || 0;
    s.H.sog = o.hs != null ? o.hs : 6; s.V.sog = o.vs != null ? o.vs : 4;
    if (o.running) E.setTimeIn(s, true);
  }
  function inMode(s, kind, team) { return !!s.mode && s.mode.kind === kind && (!team || s.mode.team === team); }
  function hasPen(s, T, p, total) { var x = E.findPen(s, T, p); return !!x && (total == null || x.total === total); }
  function updateSwitch(s, root) {
    var r = root.querySelector('[data-key="timein"]'), st = root.querySelector('#rstate');
    r.classList.toggle('on', s.timeIn); r.setAttribute('aria-pressed', String(s.timeIn));
    st.classList.toggle('on', s.timeIn);
    st.textContent = s.power === false ? 'Control off' : s.timeIn ? (s.clock > 0 || !s.countDown ? 'Clock running' : 'On, at 0:00') : 'Clock stopped';
  }
  var ctx = { E: E, cfg: cfg, fmt: fmt, numKeys: numKeys, midGame: midGame, inMode: inMode, hasPen: hasPen, updateSwitch: updateSwitch };

  /* ---------- key chips ---------- */
  function chip(k) {
    var l = CU.keyLabel(k);
    return '<kbd class="k ' + (l[1] || '') + '">' + l[0] + '</kbd>';
  }
  function chips(keys) { return keys.map(chip).join(''); }
  function seq(keys) { return '<span class="seq">' + keys.map(chip).join('') + '</span>'; }

  /* ---------- console ---------- */
  var consoleEl = $('#console'), lcdEl = null;

  function flash(key) {
    var el = $('[data-key="' + key + '"]', consoleEl);
    if (!el || key === 'timein' || key === 'power') return;
    el.classList.add('pressed');
    setTimeout(function () { el.classList.remove('pressed'); }, 110);
  }

  function doKey(key) {
    if (explain) { explainKey = key; renderPanel(); return; }
    audio();
    if (key === 'timein') { if (sim.power !== false) E.setTimeIn(sim, !sim.timeIn); }
    else E.press(sim, key);
    flash(key);
    checkLesson();
    render();
  }

  consoleEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-key]');
    if (!b || b.dataset.key === 'horn') return;
    doKey(b.dataset.key);
    if (e.detail > 0) b.blur(); // keep space bar free for the clock switch after mouse clicks
  });
  // Horn buttons sound while held. On the Nevco, SET then HORN is a menu instead.
  consoleEl.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-key="horn"]');
    if (!b) return;
    if (explain || sim.set) { doKey('horn'); return; }
    audio(); E.hornDown(sim); b.classList.add('held');
  });
  function hornRelease() { if (sim) E.hornUp(sim); consoleEl.querySelectorAll('[data-key="horn"].held').forEach(function (h) { h.classList.remove('held'); }); }
  ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, hornRelease); });
  consoleEl.addEventListener('pointerleave', hornRelease, true);
  consoleEl.addEventListener('keydown', function (e) {
    var b = e.target.closest && e.target.closest('[data-key="horn"]');
    if (b && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (sim.set) doKey('horn'); else E.hornDown(sim); }
  });
  consoleEl.addEventListener('keyup', function (e) { if (e.target.closest && e.target.closest('[data-key="horn"]')) hornRelease(); });

  document.addEventListener('keydown', function (e) {
    if (['lessons', 'drills', 'free'].indexOf(tab) < 0 || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t.closest && t.closest('input, select, textarea, a, button')) return;
    var k = null;
    if (e.key === ' ') k = 'timein';
    else if (/^[0-9]$/.test(e.key)) k = 'd' + e.key;
    else if (e.key === 'Enter') k = META.kbd.enter;
    else if (e.key === 'Backspace') k = META.kbd.back;
    if (!k) return;
    e.preventDefault();
    doKey(k);
  });

  function setHints(keys) {
    consoleEl.querySelectorAll('[data-hint]').forEach(function (el) { el.removeAttribute('data-hint'); });
    if (!keys || !keys.length) return;
    var map = {};
    keys.forEach(function (k, i) { (map[k] = map[k] || []).push(i + 1); });
    Object.keys(map).forEach(function (k) {
      var el = $('[data-key="' + k + '"]', consoleEl);
      if (el) el.dataset.hint = map[k].length > 3 ? map[k].slice(0, 2).join(',') + '..' : map[k].join(',');
    });
  }

  /* ---------- scoreboard ---------- */
  var T_ = 1.15;
  function hseg(x1, x2, y) { return [x1, y, x1 + T_, y - T_, x2 - T_, y - T_, x2, y, x2 - T_, y + T_, x1 + T_, y + T_].join(' '); }
  function vseg(x, y1, y2) { return [x, y1, x + T_, y1 + T_, x + T_, y2 - T_, x, y2, x - T_, y2 - T_, x - T_, y1 + T_].join(' '); }
  var POLY = { a: hseg(2.4, 9.6, 2), g: hseg(2.4, 9.6, 10), d: hseg(2.4, 9.6, 18), f: vseg(2, 2.4, 9.6), b: vseg(10, 2.4, 9.6), e: vseg(2, 10.4, 17.6), c: vseg(10, 10.4, 17.6) };
  var MAP = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  function segSVG(text, amber) {
    var x = 0, parts = [];
    text.split('').forEach(function (ch) {
      if (ch === ':') { parts.push('<circle class="on" cx="' + (x + 2) + '" cy="7" r="1.2"/><circle class="on" cx="' + (x + 2) + '" cy="13" r="1.2"/>'); x += 4; return; }
      if (ch === '.') { parts.push('<circle class="on" cx="' + (x + 1.6) + '" cy="18" r="1.2"/>'); x += 3.2; return; }
      var on = MAP[ch] || '';
      'abcdefg'.split('').forEach(function (s) {
        parts.push('<polygon class="' + (on.indexOf(s) >= 0 ? 'on' : 'off') + '" points="' + POLY[s] + '" transform="translate(' + x + ' 0)"/>');
      });
      x += 12;
    });
    var w = x + 1.5;
    return '<svg class="seg' + (amber ? ' amber' : '') + '" viewBox="-0.5 0 ' + w + ' 20" style="aspect-ratio:' + w + '/20" aria-hidden="true"><g transform="translate(1 0) skewX(-5)">' + parts.join('') + '</g></svg>';
  }
  function setSeg(el, text, amber) { if (el._t === text) return; el._t = text; el.innerHTML = segSVG(text, amber); }

  var boardEl = $('#board');
  function pensHTML(T) {
    return '<div class="small-label">PLAYER</div><div class="small-label">PENALTY</div>' +
      [0, 1].map(function (i) { return '<div class="pen-digits" id="b-' + T + 'p' + i + '"></div><div class="pen-digits" id="b-' + T + 't' + i + '"></div>'; }).join('') +
      '<div class="waiting" id="b-' + T + 'wait"></div>';
  }
  boardEl.innerHTML =
    '<div class="bgrid">' +
    '<div class="blabel"><span class="lamp" id="lampH"></span><span id="b-Hname">HOME</span></div>' +
    '<div class="clockbox"><div class="clock-digits" id="b-clock"></div><div class="small-label">PERIOD</div><div class="period-digits" id="b-period"></div><span class="horn" id="b-horn">HORN</span></div>' +
    '<div class="blabel"><span id="b-Vname">VISITOR</span><span class="lamp" id="lampV"></span></div>' +
    '<div class="cell score-digits" id="b-Hscore"></div>' +
    '<div class="cell score-digits" id="b-Vscore"></div>' +
    '<div class="cell"><div class="small-label">SHOTS</div><div class="sog-digits" id="b-Hsog"></div></div>' +
    '<div></div>' +
    '<div class="cell"><div class="small-label">SHOTS</div><div class="sog-digits" id="b-Vsog"></div></div>' +
    '<div class="pens">' + pensHTML('H') + '</div><div></div><div class="pens">' + pensHTML('V') + '</div>' +
    '</div>';
  var B = {};
  ['clock', 'period', 'horn', 'Hscore', 'Vscore', 'Hsog', 'Vsog', 'Hwait', 'Vwait', 'Hp0', 'Hp1', 'Ht0', 'Ht1', 'Vp0', 'Vp1', 'Vt0', 'Vt1', 'Hname', 'Vname'].forEach(function (id) { B[id] = $('#b-' + id); });
  B.lampH = $('#lampH'); B.lampV = $('#lampV');
  function padL(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

  /* ---------- sound ---------- */
  var ac = null, hornNodes = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function hornStart() {
    if (hornNodes || !soundOn) return;
    var a = audio(); if (!a) return;
    var g = a.createGain(); g.gain.value = 0.06;
    var o1 = a.createOscillator(), o2 = a.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 233; o2.frequency.value = 294;
    o1.connect(g); o2.connect(g); g.connect(a.destination); o1.start(); o2.start();
    hornNodes = { o1: o1, o2: o2, g: g };
  }
  function hornStop() {
    if (!hornNodes) return;
    try { hornNodes.o1.stop(); hornNodes.o2.stop(); } catch (e) { /* already stopped */ }
    hornNodes.g.disconnect(); hornNodes = null;
  }
  function whistle() {
    if (!soundOn) return;
    var a = audio(); if (!a) return;
    var t = a.currentTime, o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
    o.frequency.value = 2900; lfo.frequency.value = 26; lg.gain.value = 160;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.09, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.56);
    o.connect(g); g.connect(a.destination); o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
  }
  function thud() {
    if (!soundOn) return;
    var a = audio(); if (!a) return;
    var t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.15);
  }
  var soundBtn = $('#sound-btn');
  function syncSoundBtn() { soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off'); soundBtn.setAttribute('aria-pressed', soundOn); }
  soundBtn.addEventListener('click', function () { soundOn = !soundOn; save('sound', soundOn); if (!soundOn) hornStop(); else audio(); syncSoundBtn(); });
  syncSoundBtn();

  /* ---------- render ---------- */
  // A one-line display scrolls anything longer than its 16 characters, like the real thing.
  function displayText(lines) {
    if (META.lcdLines === 2) return lines[0] + '\n' + lines[1];
    var t = lines[0] || '';
    if (t.length <= 16) return t;
    var loop = t + '      ', step = Math.floor(performance.now() / 260) % loop.length;
    return (loop + loop).slice(step, step + 16);
  }
  function render() {
    var txt = displayText(E.lcd(sim));
    if (lcdEl.textContent !== txt) lcdEl.textContent = txt;
    CU.update(sim, consoleEl);

    var b = E.board(sim);
    setSeg(B.clock, padL(b.clock, 5), false);
    setSeg(B.period, sim.blank.period ? ' ' : String(b.period), true);
    ['H', 'V'].forEach(function (T) {
      var t = b[T];
      setSeg(B[T + 'score'], sim.blank[T + 'score'] ? '  ' : padL(t.score, 2), false);
      setSeg(B[T + 'sog'], sim.blank[T + 'sog'] ? '  ' : padL(t.sog, 2), true);
      [0, 1].forEach(function (i) {
        var p = t.pens[i];
        setSeg(B[T + 'p' + i], p ? padL(p.player, 2) : '  ', true);
        setSeg(B[T + 't' + i], p ? padL(p.time, 5) : '     ', true);
      });
      var w = t.waiting ? '+' + t.waiting + ' WAITING' : '';
      if (B[T + 'wait'].textContent !== w) B[T + 'wait'].textContent = w;
      B['lamp' + T].classList.toggle('on', t.goal);
    });
    B.horn.classList.toggle('on', b.horn);
    if (b.horn && soundOn) hornStart(); else hornStop();

    var coach = $('#coach');
    if (coach && coach.textContent !== sim.coach) coach.textContent = sim.coach;
    var nc = $('.nowcoach', nowbar);
    if (nc && nc.textContent !== sim.coach) nc.textContent = sim.coach;
    updateDrillUI();
  }

  /* ---------- lessons ---------- */
  function openLesson(i) {
    var def = LESSONS[i];
    sim = newGame();
    def.setup(sim);
    lesson = { i: i, def: def, step: 0, snap: clone(sim), finished: false, passing: false };
    startStep();
    renderPanel();
    render();
  }
  function startStep() {
    var st = lesson.def.steps[lesson.step];
    if (st && st.start) st.start(sim);
    lesson.snap = clone(sim);
    setHints(st && showHints ? val(st.keys) : null);
  }
  function checkLesson() {
    if (!lesson || lesson.finished || lesson.passing) return;
    var st = lesson.def.steps[lesson.step];
    if (st.check(sim, lesson.snap)) {
      lesson.passing = true;
      renderPanel();
      setTimeout(function () {
        if (!lesson) return;
        lesson.passing = false;
        lesson.step++;
        if (lesson.step >= lesson.def.steps.length) {
          lesson.finished = true;
          doneLessons[lesson.def.id] = true; save('done.' + consoleId, doneLessons);
          setHints(null);
        } else startStep();
        renderPanel();
      }, 700);
    }
  }

  /* ---------- drills: what happens on the ice; each console supplies the keys ---------- */
  function ev(o) { return Object.assign({ wait: 1600, limit: 25000, cls: '', keys: [] }, o); }
  function drop(wait) {
    return ev({ cue: 'Puck drop', cls: 'drop', sound: 'drop', detail: 'Faceoff. Start the clock.', keys: ['timein'], limit: 5000, wait: wait || rnd(1500, 3000), reaction: true,
      check: function (s) { return s.timeIn; }, fix: function (s) { E.setTimeIn(s, true); } });
  }
  function whistleEv(detail, wait) {
    return ev({ cue: 'Whistle', cls: 'whistle', sound: 'whistle', detail: detail || 'Play stopped. Stop the clock.', keys: ['timein'], limit: 5000, wait: wait || rnd(3000, 7000), reaction: true,
      check: function (s) { return !s.timeIn; }, fix: function (s) { E.setTimeIn(s, false); } });
  }
  function penaltyEv(T, p, ms, why, wait) {
    return ev({ cue: 'Whistle: penalty', cls: 'whistle', sound: 'whistle', wait: wait || rnd(3000, 6000), limit: 30000,
      detail: teamName(T) + ' #' + p + ', ' + why + ', ' + E.fmt(ms) + '. Stop the clock and enter it.',
      keys: function () { return ['timein'].concat(CU.recipes.penalty(T, p, ms)); },
      check: function (s) { return !s.timeIn && hasPen(s, T, p, ms); },
      fix: function (s) { E.setTimeIn(s, false); if (!hasPen(s, T, p)) E.addPenalty(s, T, String(p), ms); s.mode = null; s.set = false; } });
  }
  function goalEv(T, p, wait, extra) {
    return ev({ cue: 'Whistle: goal!', cls: 'whistle', sound: 'whistle', wait: wait || rnd(3000, 6000),
      detail: teamName(T) + ' #' + p + ' scores' + (extra || '') + '. Stop the clock, add the goal and the shot.',
      keys: function () { return ['timein'].concat(CU.recipes.goal(T)); },
      check: function (s, q) { return !s.timeIn && s[T].score === q[T].score + 1 && s[T].sog === q[T].sog + 1; },
      fix: function (s, q) { E.setTimeIn(s, false); s[T].score = q[T].score + 1; s[T].sog = q[T].sog + 1; s.mode = null; s.set = false; } });
  }
  function shotEv(T, wait) {
    return ev({ cue: 'Shot on goal', wait: wait || rnd(2500, 5000), detail: teamName(T) + ' shoots, the goalie makes the save, play goes on. Count the shot.',
      keys: function () { return CU.recipes.shot(T); }, limit: 15000,
      check: function (s, q) { return s[T].sog === q[T].sog + 1; },
      fix: function (s, q) { s[T].sog = q[T].sog + 1; } });
  }
  function clearEv(T, p, why) {
    return ev({ cue: 'Power-play goal', wait: 900, detail: why,
      keys: function (q) { return CU.recipes.clearPenalty(T, p, q); },
      check: function (s) { return !hasPen(s, T, p); },
      fix: function (s) { var x = E.findPen(s, T, p); if (x) s[T].pens.splice(s[T].pens.indexOf(x), 1); s.mode = null; s.set = false; } });
  }
  function refEv(detail, keys, check, fix, wait) {
    return ev({ cue: 'Ref says', wait: wait || 1400, limit: 45000, detail: detail, keys: keys, check: check,
      fix: function (s, q) { fix(s, q); s.mode = null; s.set = false; } });
  }

  function buildDrills() {
    return [
      {
        id: 'react', title: 'Whistle and faceoff', sub: '12 cues. Only the ' + META.switchName + '. Measures your reaction time.',
        setup: function (s) { s.clock = cfg.periodLen * SEC; },
        build: function () {
          var out = [];
          for (var i = 0; i < 6; i++) { out.push(drop(i === 0 ? 1500 : rnd(1500, 3500))); out.push(whistleEv(null, rnd(2500, 6500))); }
          return out;
        }
      },
      {
        id: 'period', title: 'Play a period', sub: 'Shots, a penalty, a goal, a power play and the end of the period.',
        setup: function (s) { s.clock = cfg.periodLen * SEC; },
        build: function () {
          var pl = pickPlayers(2), p1 = pl[0], p2 = pl[1];
          return [
            drop(1500), shotEv('H'), whistleEv('Offside. Stop the clock.'), drop(),
            penaltyEv('V', p1, cfg.minor * SEC, 'hooking'), drop(), shotEv('V'),
            goalEv('H', p2, null, ' on the power play'),
            clearEv('V', p1, 'Home scored while ' + teamName('V') + ' #' + p1 + ' was in the box. Clear #' + p1 + '\'s minor.'),
            drop(),
            ev({ cue: 'End of period', wait: 2500, limit: 20000, detail: 'Skipping ahead to the last seconds. Let the clock run out.', keys: [],
              pre: function (s) { if (!s.timeIn) E.setTimeIn(s, true); s.clock = Math.min(s.clock, 6 * SEC); },
              check: function (s) { return s.clock === 0; }, fix: function (s) { s.clock = 0; } }),
            ev({ cue: 'Intermission', wait: 1500, limit: 50000, detail: 'Get ready for period 2: clock off, period up by one, clock set to ' + fmt(cfg.periodLen) + '.',
              keys: function (q) { return ['timein'].concat(CU.recipes.nextPeriod(q)); },
              check: function (s, q) { return !s.timeIn && s.period === q.period + 1 && s.clock === cfg.periodLen * SEC && s.periodType === 'game' && !s.mode; },
              fix: function (s, q) { E.setTimeIn(s, false); s.period = q.period + 1; s.clock = cfg.periodLen * SEC; s.periodType = 'game'; s.mode = null; s.set = false; } })
          ];
        }
      },
      {
        id: 'pens', title: 'Penalty trouble', sub: 'A major, a waiting penalty, and which one a goal ends.',
        setup: function (s) { s.clock = (cfg.periodLen - 240) * SEC; s.period = 2; s.H.score = 1; s.V.score = 1; s.H.sog = 9; s.V.sog = 8; },
        build: function () {
          var pl = pickPlayers(3), a = pl[0], b = pl[1], c = pl[2];
          return [
            drop(1500), penaltyEv('H', a, 300 * SEC, 'boarding (major)'), drop(),
            penaltyEv('H', b, cfg.minor * SEC, 'tripping'), drop(),
            penaltyEv('H', c, cfg.minor * SEC, 'slashing'), drop(),
            goalEv('V', rnd(2, 29), null, ' on the power play'),
            clearEv('H', b, 'A power-play goal ends one minor: the one that started first. That is #' + b + ', not the major on #' + a + '. Clear it.'),
            drop()
          ];
        }
      },
      {
        id: 'fix', title: 'Fix the board', sub: 'The ref spotted five mistakes. Correct each one.',
        setup: function (s) {
          s.period = 3; s.clock = 495 * SEC; s.H.score = 3; s.V.score = 1; s.H.sog = 12; s.V.sog = 11;
          E.addPenalty(s, 'V', '7', 300 * SEC); s.V.pens[0].left = 290 * SEC;
        },
        build: function () {
          var R = CU.recipes;
          return [
            refEv('That last home goal was waved off. Home should have 2.', function (q) { return R.scoreDown('H', q); },
              function (s) { return s.H.score === 2; }, function (s) { s.H.score = 2; }, 1200),
            refEv(teamName('V') + ' #7 got a minor, not a major. Change it to ' + minorStr() + '.', function (q) { return R.setPenaltyTime('V', 7, cfg.minor * SEC, q); },
              function (s) { var x = E.findPen(s, 'V', 7); return !!x && Math.abs(x.left - cfg.minor * SEC) < SEC; },
              function (s) { var x = E.findPen(s, 'V', 7); if (x) { x.left = cfg.minor * SEC; x.total = x.left; } }),
            refEv('The board says period 3. It is period 2.', function (q) { return R.periodDown(q); },
              function (s) { return s.period === 2; }, function (s) { s.period = 2; }),
            refEv('Put 3 seconds back: the clock should read 8:18. Keep the penalty times as they are.', function (q) { return R.fixClock(498, q); },
              function (s) { return s.clock === 498 * SEC && !s.mode; }, function (s) { s.clock = 498 * SEC; }),
            refEv(teamName('V') + ' should have 12 shots, not 11.', function (q) { return R.shotUp('V', q); },
              function (s) { return s.V.sog === 12; }, function (s) { s.V.sog = 12; }),
            drop(2000)
          ];
        }
      }
    ];
  }

  function startDrill(i) {
    audio();
    var def = DRILLS[i];
    sim = newGame();
    def.setup(sim);
    drill = { def: def, events: def.build(), idx: -1, phase: 'wait', until: 0, t0: 0, results: [], snap: null, last: null, keys: [] };
    setHints(null);
    nextEvent(performance.now());
    renderPanel();
    render();
  }
  function nextEvent(now) {
    drill.idx++;
    if (drill.idx >= drill.events.length) { drill.phase = 'done'; setHints(null); renderPanel(); return; }
    drill.phase = 'wait';
    drill.until = now + drill.events[drill.idx].wait;
    setHints(null);
    renderPanel();
  }
  function updateDrill(now) {
    if (!drill || tab !== 'drills') return;
    var e = drill.events[drill.idx];
    if (drill.phase === 'wait' && now >= drill.until) {
      if (e.pre) e.pre(sim);
      drill.snap = clone(sim);
      drill.keys = typeof e.keys === 'function' ? e.keys(drill.snap) : e.keys;
      drill.t0 = now;
      drill.phase = 'active';
      if (e.sound === 'whistle') whistle(); else if (e.sound === 'drop') thud();
      setHints(drillHints ? drill.keys : null);
      renderPanel();
    } else if (drill.phase === 'active') {
      if (e.check(sim, drill.snap)) finishEvent(true, now);
      else if (now - drill.t0 > e.limit) finishEvent(false, now);
    } else if (drill.phase === 'feedback' && now >= drill.until) nextEvent(now);
  }
  function finishEvent(ok, now) {
    var e = drill.events[drill.idx];
    if (!ok) e.fix(sim, drill.snap);
    drill.results.push({ ok: ok, ms: now - drill.t0, cue: e.cue, reaction: !!e.reaction });
    drill.last = { ok: ok, e: e, ms: now - drill.t0, keys: drill.keys };
    drill.phase = 'feedback';
    drill.until = now + (ok ? 900 : 3600);
    setHints(ok ? null : drill.keys);
    renderPanel();
  }
  function updateDrillUI() {
    if (!drill || drill.phase !== 'active') return;
    var bar = $('#tbar');
    if (!bar) return;
    var e = drill.events[drill.idx];
    var left = Math.max(0, 1 - (performance.now() - drill.t0) / e.limit);
    bar.style.width = (left * 100).toFixed(1) + '%';
  }

  /* ---------- panel ---------- */
  var panel = $('#panel');
  function renderPanel() {
    if (tab === 'lessons') panel.innerHTML = lessonPanel();
    else if (tab === 'drills') panel.innerHTML = drillPanel();
    else if (tab === 'free') panel.innerHTML = freePanel();
    renderNow();
  }

  // phones: a one-line copy of the current instruction, placed right above the console
  var nowbar = $('#nowbar');
  function renderNow() {
    var h = '';
    if (tab === 'lessons') {
      if (!lesson) h = 'Pick a lesson below the console.';
      else if (lesson.finished) h = '<b class="lbl drop">Lesson done</b>See below the console for what is next.';
      else h = '<b class="lbl">Step ' + (lesson.step + 1) + ' of ' + lesson.def.steps.length + '</b>' + val(lesson.def.steps[lesson.step].t);
    } else if (tab === 'drills') {
      if (!drill) h = 'Pick a drill below the console.';
      else if (drill.phase === 'done') h = '<b class="lbl">Final buzzer</b>Your results are below the console.';
      else if (drill.phase === 'wait') h = '<b class="lbl">' + (sim.timeIn ? 'Play on...' : 'Stoppage...') + '</b>Watch for the next call.';
      else if (drill.phase === 'feedback') h = drill.last.ok ? '<b class="lbl drop">Got it</b>' : '<b class="lbl">Out of time</b>The highlighted keys show what to press.';
      else { var e = drill.events[drill.idx]; h = '<b class="lbl ' + e.cls + '">' + e.cue + '</b>' + e.detail; }
    } else if (tab === 'free') {
      var info = explain && explainKey && CU.info[explainKey];
      h = info ? '<b class="lbl">' + info[0] + '</b>' + info[1] : explain ? 'Tap any key to see what it does.' : '<b class="lbl">Free play</b>Press anything. Options are below the console.';
    }
    nowbar.innerHTML = h + '<span class="nowcoach"></span>';
  }

  // Sidebars are one bordered box, like the home page grid: each direct child of .card is a
  // cell or an edge-to-edge list, and every rule between them runs to the outer border.
  function coachCell() {
    return '<div class="pcell coachcell"><p class="tip warn coach" id="coach">' + (sim.coach || '') + '</p></div>';
  }
  function consoleTag() { return '<span class="badge">' + META.name + '</span>'; }

  function lessonPanel() {
    if (!lesson) {
      var count = LESSONS.filter(function (l) { return doneLessons[l.id]; }).length;
      return '<div class="card"><div class="pcell"><div class="row" style="justify-content:space-between"><span class="eyebrow">Lessons</span>' + consoleTag() + '</div><h2>Learn one job at a time</h2>' +
        '<p class="muted">Each lesson sets up a game situation and walks you through it. The keys to press are outlined in coral on the console, numbered in order. ' + count + ' of ' + LESSONS.length + ' done.</p></div>' +
        '<ol class="lesson-list">' + LESSONS.map(function (l, i) {
          return '<li><button type="button" data-open="' + i + '" class="' + (doneLessons[l.id] ? 'done' : '') + '"><span class="n">' + (doneLessons[l.id] ? '&#10003;' : i + 1) + '</span><span class="t">' + l.title + '<small>' + l.sub + '</small></span><span class="badge">' + l.steps.length + ' steps</span></button></li>';
        }).join('') + '</ol></div>';
    }
    var d = lesson.def, steps = d.steps;
    var html = '<div class="card"><div class="pcell"><div class="row" style="justify-content:space-between"><span class="eyebrow">Lesson ' + (lesson.i + 1) + ' of ' + LESSONS.length + '</span>' +
      '<label class="toggle" for="hint-toggle"><input type="checkbox" id="hint-toggle"' + (showHints ? ' checked' : '') + '> Light up keys</label></div>' +
      '<h2>' + d.title + '</h2><p>' + val(d.intro) + '</p></div>' +
      '<ol class="steps">' + steps.map(function (st, i) {
        var cls = i < lesson.step || (i === lesson.step && (lesson.passing || lesson.finished)) ? 'done' : i === lesson.step ? 'current' : 'upcoming';
        var keys = val(st.keys);
        return '<li class="' + cls + '"><div>' + val(st.t) + (keys.length ? '<div class="keys">' + chips(keys) + '</div>' : '') + '</div></li>';
      }).join('') + '</ol>' +
      coachCell();
    if (lesson.finished) {
      var next = lesson.i + 1 < LESSONS.length;
      html += '<div class="pcell done-box"><b>Lesson done</b><p>' + val(d.wrap) + '</p><div class="row">' +
        (next ? '<button type="button" class="btn primary" data-open="' + (lesson.i + 1) + '">Next: ' + LESSONS[lesson.i + 1].title + '</button>' : '<a class="btn primary" href="#drills">Try a practice drill</a>') +
        '</div></div>';
    }
    html += '<div class="pcell actions"><div class="row"><button type="button" class="btn small" data-act="lessons">All lessons</button><button type="button" class="btn small" data-open="' + lesson.i + '">Restart lesson</button></div></div></div>';
    return html;
  }

  function drillPanel() {
    if (!drill) {
      return '<div class="card"><div class="pcell"><div class="row" style="justify-content:space-between"><span class="eyebrow">Practice</span>' + consoleTag() + '</div><h2>Run a fake game</h2>' +
        '<p class="muted">Things happen on the ice and you react. Each task has a time limit. If you run out of time, the console shows you the keys and fixes the board so the game can go on.</p>' +
        '<label class="toggle" for="dhint-toggle"><input type="checkbox" id="dhint-toggle"' + (drillHints ? ' checked' : '') + '> Light up the keys (easier)</label></div>' +
        '<div class="drill-list">' + DRILLS.map(function (d, i) { return '<button type="button" data-drill="' + i + '"><b>' + d.title + '</b><span>' + d.sub + '</span></button>'; }).join('') + '</div>' +
        '<div class="pcell"><p class="fine">Turn the sound on to hear the whistle. Your rules: ' + fmt(cfg.periodLen) + ' periods, ' + minorStr() + ' minors. Change them on the Start here page.</p></div></div>';
    }
    var d = drill.def, total = drill.events.length;
    if (drill.phase === 'done') {
      var ok = drill.results.filter(function (r) { return r.ok; }).length;
      var re = drill.results.filter(function (r) { return r.reaction && r.ok; });
      var avg = re.length ? re.reduce(function (a, r) { return a + r.ms; }, 0) / re.length / 1000 : 0;
      var lost = drill.results.filter(function (r) { return r.reaction; }).reduce(function (a, r) { return a + r.ms; }, 0) / 1000;
      var verdict = ok === total ? 'Clean game. You are ready for this part.' : ok >= total - 2 ? 'Close. Run it once more and it will stick.' : 'Do the matching lessons again, then come back.';
      return '<div class="card"><div class="pcell"><div class="eyebrow">' + d.title + '</div><h2>Final buzzer</h2></div>' +
        '<div class="stats"><div><b>' + ok + '/' + total + '</b><span>done in time</span></div><div><b>' + (re.length ? avg.toFixed(2) + 's' : '-') + '</b><span>average reaction</span></div><div><b>' + lost.toFixed(1) + 's</b><span>clock error, total</span></div></div>' +
        '<div class="pcell"><p>' + verdict + ' Under one second per whistle is a good target.</p></div>' +
        resultsList() +
        '<div class="pcell actions"><div class="row"><button type="button" class="btn primary" data-drill="' + DRILLS.indexOf(d) + '">Play again</button><button type="button" class="btn" data-act="drills">Other drills</button></div></div></div>';
    }
    var e = drill.events[drill.idx];
    var cue = drill.phase === 'wait'
      ? '<div class="pcell cue waiting"><div class="what">' + (sim.timeIn ? 'Play on...' : 'Stoppage...') + '</div><div class="detail">Watch for the next call.</div></div>'
      : '<div class="pcell cue"><div class="what ' + e.cls + '">' + e.cue + '</div><div class="detail">' + e.detail + '</div><div class="timerbar"><i id="tbar"></i></div></div>';
    var fb = '';
    if (drill.phase === 'feedback' && drill.last) {
      fb = drill.last.ok
        ? '<div class="pcell feedback good"><b>Got it</b> ' + (drill.last.e.reaction ? (drill.last.ms / 1000).toFixed(2) + ' seconds' : 'in ' + (drill.last.ms / 1000).toFixed(1) + ' seconds') + '</div>'
        : '<div class="pcell feedback miss"><b>Out of time.</b><span>The keys were: </span><span class="seq">' + chips(drill.last.keys || []) + '</span><span>The board has been fixed so the game can continue.</span></div>';
    }
    return '<div class="card"><div class="pcell"><div class="row" style="justify-content:space-between"><span class="eyebrow">' + d.title + '</span><span class="badge">' + Math.min(drill.idx + 1, total) + ' of ' + total + '</span></div></div>' +
      cue + fb + coachCell() + resultsList() +
      '<div class="pcell actions"><div class="row"><button type="button" class="btn small" data-act="stopdrill">Stop drill</button></div></div></div>';
  }
  function resultsList() {
    if (!drill || !drill.results.length) return '';
    return '<ul class="results">' + drill.results.map(function (r) {
      return '<li><span class="' + (r.ok ? 'ok' : 'x') + '">' + (r.ok ? '&#10003;' : '&#10007;') + '</span><span>' + r.cue + '</span><span class="tm">' + (r.ms / 1000).toFixed(r.reaction ? 2 : 1) + 's</span></li>';
    }).join('') + '</ul>';
  }

  function freePanel() {
    var info = explainKey && CU.info[explainKey];
    return '<div class="card"><div class="pcell"><div class="row" style="justify-content:space-between"><span class="eyebrow">Free play</span>' + consoleTag() + '</div><h2>Try anything</h2>' +
      '<p class="muted">No instructions, no timer. The board starts mid-game with a couple of penalties running. Press keys and see what happens.</p>' +
      '<label class="toggle" for="explain-toggle"><input type="checkbox" id="explain-toggle"' + (explain ? ' checked' : '') + '> Explain keys instead of pressing them</label></div>' +
      (explain ? '<div class="pcell explain">' + (info ? '<h3>' + info[0] + '</h3><p>' + info[1] + '</p>' : '<p class="muted">Tap any key or switch on the console to see what it does.</p>') + '</div>' : '') +
      coachCell() +
      '<div class="pcell actions"><div class="row"><button type="button" class="btn small" data-act="sample">Load sample game</button><button type="button" class="btn small" data-act="fresh">Fresh game</button></div></div></div>';
  }

  panel.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open],[data-drill],[data-act]');
    if (!b) return;
    if (b.dataset.open != null) { openLesson(+b.dataset.open); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (b.dataset.drill != null) { startDrill(+b.dataset.drill); return; }
    var a = b.dataset.act;
    if (a === 'lessons') { lesson = null; setHints(null); renderPanel(); }
    else if (a === 'drills' || a === 'stopdrill') { drill = null; setHints(null); E.setTimeIn(sim, false); renderPanel(); }
    else if (a === 'sample') { loadSample(); renderPanel(); }
    else if (a === 'fresh') { sim = newGame(); renderPanel(); }
  });
  panel.addEventListener('change', function (e) {
    if (e.target.id === 'hint-toggle') { showHints = e.target.checked; save('hints', showHints); if (lesson && !lesson.finished) setHints(showHints ? val(lesson.def.steps[lesson.step].keys) : null); }
    if (e.target.id === 'dhint-toggle') { drillHints = e.target.checked; save('drillHints', drillHints); }
    if (e.target.id === 'explain-toggle') { explain = e.target.checked; consoleEl.classList.toggle('explaining', explain); explainKey = null; renderPanel(); }
  });

  function loadSample() {
    sim = newGame();
    midGame(sim, { period: 2, clock: Math.min(522, cfg.periodLen - 60), h: 3, v: 2, hs: 14, vs: 11 });
    E.addPenalty(sim, 'V', '7', cfg.minor * SEC); sim.V.pens[0].left = 64 * SEC;
    E.addPenalty(sim, 'H', '18', 300 * SEC); sim.H.pens[0].left = 211 * SEC;
  }

  /* ---------- cheat sheet ---------- */
  function renderSheet() {
    var sh = CU.sheet();
    function rows(list) { return '<table>' + list.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + seq(r[1]) + (r[2] ? '<div class="muted" style="font-size:13px;margin-top:4px">' + r[2] + '</div>' : '') + '</td></tr>'; }).join('') + '</table>'; }
    function screenChip(text) {
      var cls = sh.screen.style === 'led' ? 'ledchip' : 'lcdchip';
      if (text.length > 16) return '<code class="' + cls + ' scroll"><span>' + text + '&nbsp;&nbsp;&nbsp;&nbsp;' + text + '</span></code>';
      return '<code class="' + cls + '">' + (text + '                ').slice(0, 16) + '</code>';
    }
    $('#sheet').innerHTML =
      '<div class="sheet-head"><div class="eyebrow">Keep this open in the scorer\'s box</div><h1>Cheat sheet: ' + META.name + '</h1>' +
      '<p class="muted">' + sh.intro + ' Take a screenshot to keep it on your phone.</p></div>' +
      '<div class="sheet-grid boxgrid">' +
      sh.cards.map(function (c) { return '<div class="sheet-card"><h2>' + c.title + '</h2>' + rows(c.rows) + '</div>'; }).join('') +
      '<div class="sheet-card"><h2>Screen messages</h2><p class="sheet-note">' + sh.screen.note + '</p><table class="lcd-table">' +
      sh.screen.list.map(function (r) { return '<tr><td>' + screenChip(r[0]) + '</td><td>' + r[1] + '</td></tr>'; }).join('') +
      '</table></div></div>' +
      '<p class="fine">' + sh.source + '</p>';
  }

  /* ---------- home page: the consoles overview ---------- */
  function renderStart() {
    $('#picker').innerHTML = ORDER.map(function (id) {
      var c = CONSOLES[id], on = id === consoleId;
      return '<button type="button" class="pick' + (on ? ' on' : '') + '" data-console="' + id + '">' +
        '<span class="pick-maker">' + c.maker + '</span><b>' + c.name + '</b><span class="pick-look">' + c.lookFor + '</span>' +
        '<span class="pick-state">' + (on ? 'Your console: start lessons' : 'Start its lessons') + '</span></button>';
    }).join('') +
      '<div class="pick soon" aria-disabled="true"><span class="pick-maker">Daktronics</span><b>All Sport 5000</b><span class="pick-look">Coming next.</span><span class="pick-state">Not yet</span></div>';
    $('#routine').innerHTML = CU.routine.map(function (r) {
      return '<section><h3>' + r[0] + '</h3><ol>' + r[1].map(function (item) {
        return '<li>' + item.replace(/\[\[([^\]]+)\]\]/g, function (m, keys) { return seq(keys.split(' ')); }) + '</li>';
      }).join('') + '</ol></section>';
    }).join('');
    $('#start-source').innerHTML = CU.sheet().source + ' The console screen text is copied from the manual where it shows it; other screens are close approximations. Your rink may have changed settings, so do one dry run on the real console before your first game.';
    document.querySelectorAll('[data-console-name]').forEach(function (el) { el.textContent = META.name; });
  }
  $('#picker').addEventListener('click', function (e) {
    var b = e.target.closest('[data-console]');
    if (!b) return;
    setConsole(b.dataset.console);
    renderStart();
    if (location.hash === '#lessons') go('lessons'); else location.hash = 'lessons';
  });

  /* ---------- setup bar (lessons, practice, free play, cheat sheet): console + league rules ---------- */
  function renderSetup() {
    $('#console-switch').innerHTML = ORDER.map(function (id) {
      return '<button type="button" data-switch="' + id + '" aria-pressed="' + (id === consoleId) + '">' + CONSOLES[id].name + '</button>';
    }).join('') + '<span class="soon">Daktronics coming</span>';
    $('#console-note').innerHTML = CU.startNote();
  }
  $('#console-switch').addEventListener('click', function (e) {
    var b = e.target.closest('[data-switch]');
    if (!b || b.dataset.switch === consoleId) return;
    setConsole(b.dataset.switch);
    if (tab === 'free') loadSample();
    renderStart();
    render();
  });

  function setConsole(id) {
    if (!CONSOLES[id]) return;
    consoleId = id;
    META = CONSOLES[id];
    save('console', id);
    CU = META.make(ctx);
    consoleEl.className = 'console console-' + id;
    consoleEl.innerHTML = CU.html();
    CU.mounted(consoleEl);
    lcdEl = $('#lcd', consoleEl);
    $('#console-tip').innerHTML = CU.consoleTip;
    LESSONS = CU.lessons;
    DRILLS = buildDrills();
    var legacy = id === 'fairplay' ? load('done', {}) : {};
    doneLessons = load('done.' + id, legacy);
    lesson = null; drill = null; explain = false; explainKey = null;
    sim = newGame();
    B.Hname.textContent = META.teams.H; B.Vname.textContent = META.teams.V;
    renderSetup();
    renderSheet();
    renderPanel();
    render();
  }

  /* ---------- setup form ---------- */
  var setPeriod = $('#set-period'), setMinor = $('#set-minor'), setTenths = $('#set-tenths');
  function syncForm() { setPeriod.value = String(cfg.periodLen); setMinor.value = String(cfg.minor); setTenths.value = cfg.tenths ? '1' : '0'; }
  syncForm();
  $('#setup-form').addEventListener('change', function () {
    cfg.periodLen = +setPeriod.value; cfg.minor = +setMinor.value; cfg.tenths = setTenths.value === '1';
    save('cfg', { periodLen: cfg.periodLen, minor: cfg.minor, tenths: cfg.tenths });
    sim.cfg = cfg;
    DRILLS = buildDrills();
    renderSheet();
  });
  $('#setup-form').addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------- tabs ---------- */
  var TABS = ['start', 'lessons', 'drills', 'free', 'cheat'];
  function go(t) {
    if (CONSOLES[t]) { setConsole(t); renderStart(); t = 'lessons'; }
    var jump = t === 'console';                       // header link: show the setup bar
    if (jump) t = ['lessons', 'drills', 'free', 'cheat'].indexOf(tab) >= 0 ? tab : 'lessons';
    if (TABS.indexOf(t) < 0) t = 'start';
    var prev = tab;
    tab = t;
    document.querySelectorAll('nav.tabs a').forEach(function (a) { if (a.dataset.tab === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#view-start').hidden = t !== 'start';
    $('#view-cheat').hidden = t !== 'cheat';
    $('#view-trainer').hidden = ['lessons', 'drills', 'free'].indexOf(t) < 0;
    $('#setup-form').hidden = t === 'start';
    if (prev === 'drills' && t !== 'drills') { drill = null; }
    if (t !== 'free') { explain = false; consoleEl.classList.remove('explaining'); }
    setHints(null);
    if (t === 'lessons') { if (lesson) { if (!lesson.finished) setHints(showHints ? val(lesson.def.steps[lesson.step].keys) : null); } else sim = newGame(); }
    if (t === 'drills' && !drill) sim = newGame();
    if (t === 'free' && prev !== 'free') { loadSample(); lesson = null; }
    if (t === 'cheat') renderSheet();
    hornStop();
    renderPanel();
    render();
    window.scrollTo(0, 0);
    if (jump) $('#console-switch').querySelector('[aria-pressed="true"]').focus();
  }
  window.addEventListener('hashchange', function () { go(location.hash.slice(1)); });

  /* ---------- loop ---------- */
  var last = performance.now();
  function frame() {
    var now = performance.now();
    var dt = Math.min(1000, now - last);
    last = now;
    if (['lessons', 'drills', 'free'].indexOf(tab) >= 0) {
      E.tick(sim, dt);
      updateDrill(now);
      checkLesson();
      render();
    }
  }

  /* ---------- small screens: suggest a computer, once per device ---------- */
  var notice = $('#small-notice');
  function closeNotice() { notice.hidden = true; save('smallNoticeSeen', true); }
  if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches && !load('smallNoticeSeen', false)) {
    notice.hidden = false;
    setTimeout(function () { $('#small-notice-ok').focus(); }, 0);
  }
  $('#small-notice-ok').addEventListener('click', closeNotice);
  $('#small-notice-cheat').addEventListener('click', closeNotice);
  notice.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNotice(); });

  setConsole(consoleId);
  renderStart();
  go(location.hash.slice(1) || 'start');
  setInterval(frame, 50);
})();
