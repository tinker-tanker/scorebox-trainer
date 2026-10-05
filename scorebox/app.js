(function () {
  'use strict';
  var E = window.Engine, SEC = E.SEC;

  /* ---------- storage (per-viewer conveniences only) ---------- */
  function load(k, d) { try { var v = localStorage.getItem('sbt.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('sbt.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

  var cfg = Object.assign(E.defaultSettings(), { periodLen: 900, minor: 90, tenths: true }, load('cfg', {}));
  cfg.pen3 = 90;
  var sim = E.newGame(cfg);
  var tab = 'start';
  var explain = false;
  var showHints = load('hints', true);
  var drillHints = load('drillHints', false);
  var soundOn = load('sound', true);
  var doneLessons = load('done', {});
  var lesson = null, drill = null, freeLoaded = false, explainKey = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function fmt(sec) { return E.fmt(sec * SEC); }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pickPlayers(n) {
    var out = [];
    while (out.length < n) { var p = rnd(2, 29); if (out.indexOf(p) < 0) out.push(p); }
    return out;
  }

  /* ---------- rule helpers ---------- */
  function minorKey() { return cfg.minor === cfg.pen3 ? 'plus3' : 'plus1'; }
  function minorStr() { return fmt(cfg.minor); }
  function timeKeys(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (String(m) + (s < 10 ? '0' : '') + s).split('').map(function (d) { return 'd' + d; });
  }
  function numKeys(n) { return String(n).split('').map(function (d) { return 'd' + d; }); }
  function spaced(n) { return String(n).split('').join(' '); }
  function timeDigits(sec) { return timeKeys(sec).map(function (k) { return k.slice(1); }).join(' '); }

  /* ---------- key labels ---------- */
  var KL = {
    settimer: ['Set Timer'], autohorn: ['Auto Horn'], clockset: ['Clock Set'], period: ['Period'],
    htimeout: ['Home Timeout', 'blue'], vtimeout: ['Visitor Timeout', 'yellow'], minus1: ['-1'],
    bridim: ['Bri. Dim'], hsog: ['Home S.O.G.', 'blue'], vsog: ['Visitor S.O.G.', 'yellow'], setint: ['Set Interval'],
    hpen: ['Home Penalty', 'blue'], vpen: ['Visitor Penalty', 'yellow'], plus3: ['+3'], plus2: ['+2'], plus1: ['+1'],
    hgoal: ['Home Goal', 'blue'], vgoal: ['Visitor Goal', 'yellow'], hscore: ['Home Score', 'blue'], vscore: ['Visitor Score', 'yellow'],
    clr: ['CLR', 'white'], enter: ['Enter', 'white'], shift: ['Shift', 'green'], timein: ['Time In', 'switch'], horn: ['Horn', 'switch']
  };
  function chip(k) {
    if (/^d\d$/.test(k)) return '<kbd class="k white">' + k.slice(1) + '</kbd>';
    var l = KL[k] || [k];
    return '<kbd class="k ' + (l[1] || '') + '">' + l[0] + '</kbd>';
  }
  function chips(keys) { return keys.map(chip).join(''); }
  function seq(keys) { return '<span class="seq">' + keys.map(chip).join('') + '</span>'; }

  /* ---------- explain text ---------- */
  var INFO = {
    timein: ['TIME IN switch', 'Starts and stops the game clock. Flip it on when the referee drops the puck, off at every whistle. Penalty clocks follow it automatically. Turning it off also silences the horn.'],
    horn: ['HORN', 'Sounds the horn while you hold it. You rarely need it: with AUTO HORN on, the horn sounds by itself at the end of each period.'],
    autohorn: ['AUTO HORN', 'Turns the automatic end-of-period horn on or off. The light next to the screen shows it is on. Leave it on.'],
    clockset: ['CLOCK SET', 'Sets the game clock. Only works with TIME IN off. Press it, type the time without the colon (1300 for 13:00), press ENTER. Press it twice for the break clock, three times for overtime. With SHIFT it changes the clock to count up or down; you will not need that.'],
    period: ['PERIOD', 'Changes the period number. Press PERIOD, then +1. With SHIFT it is NEW GAME, which clears scores, shots and penalties.'],
    hscore: ['HOME SCORE', 'Changes the home score. Press it, then +1 for a goal (the goal light flashes by itself) or -1 to take one away. You can also type a number and press ENTER.'],
    vscore: ['VISITOR SCORE', 'Same as HOME SCORE, for the visiting team.'],
    hsog: ['HOME S.O.G.', 'Shots on goal for the home team. Press it, then +1. The clock does not need to stop.'],
    vsog: ['VISITOR S.O.G.', 'Shots on goal for the visiting team.'],
    hpen: ['HOME PENALTY', 'Enters a home penalty: HOME PENALTY, a time key (+1, +2 or +3), the player number, ENTER. To clear or change one: HOME PENALTY, player number, ENTER, then ENTER again (clear) or a new time and ENTER. With SHIFT it lists all home penalties.'],
    vpen: ['VISITOR PENALTY', 'Same as HOME PENALTY, for the visiting team.'],
    plus1: ['+1 (2:00)', 'Adds 1 to a score, shot count or period. In a penalty it enters 2:00.'],
    plus2: ['+2 (5:00)', 'Adds 2. In a penalty it enters 5:00, a major.'],
    plus3: ['+3 (01:30 sticker)', 'Adds 3. In a penalty it enters 1:30 on your rink\'s console. The manual says the factory setting is 10:00, so the sticker tells you someone changed it.'],
    minus1: ['-1', 'Takes 1 away from a score, shot count or period. It also starts a timeout countdown. With SHIFT it is BLANK, which hides the last number you selected on the scoreboard.'],
    hgoal: ['HOME GOAL', 'Only switches the red goal light on or off. It does NOT add a goal. Use HOME SCORE then +1 for goals.'],
    vgoal: ['VISITOR GOAL', 'Only switches the visitor goal light. It does NOT add a goal.'],
    htimeout: ['HOME TIMEOUT', 'With the clock stopped: press it, then -1 to start the timeout countdown and use one of the team\'s timeouts. T.O.L. means timeouts left.'],
    vtimeout: ['VISITOR TIMEOUT', 'Same as HOME TIMEOUT, for the visiting team.'],
    settimer: ['SET TIMER', 'Not used for hockey. With SHIFT it is T.O.D., which shows the time of day on the scoreboard instead of the game clock. Answer NO (SHIFT + 6) to bring the game clock back.'],
    bridim: ['BRI. DIM', 'Brightness for outdoor scoreboards. It does nothing at an indoor rink.'],
    setint: ['SET INTERVAL', 'An extra timer that sounds the horn every so often without stopping the game, used for line changes in some youth games. With SHIFT it turns the interval timer on or off. Only use it if your rink asks you to.'],
    shift: ['SHIFT', 'Unlocks the green labels. On the real console, hold SHIFT down while pressing the other key. Here, tap SHIFT and then the key.'],
    clr: ['CLR / ESC', 'CLR erases what you typed, before you press ENTER. With SHIFT it is ESC: it backs you out of whatever the screen is asking.'],
    enter: ['ENTER', 'Saves what you typed. Once you press ENTER the value is on the scoreboard, so check the number first.'],
    d4: ['4 / YES', 'A number key. With SHIFT it answers YES to a question on the screen.'],
    d5: ['5 / NEXT', 'A number key. NEXT is only used in the setup menus.'],
    d6: ['6 / NO', 'A number key. With SHIFT it answers NO to a question on the screen.'],
    d8: ['8 / up arrow', 'A number key. The arrow is only used in the setup menus.'],
    d2: ['2 / down arrow', 'A number key. The arrow is only used in the setup menus.']
  };

  /* ---------- console ---------- */
  var FN = [
    ['settimer', 'Set<br>Timer', 'T.O.D.'], ['autohorn', 'Auto<br>Horn'], ['clockset', 'Clock<br>Set', 'Clk. Up/Dn'], ['period', 'Period', 'New Game'],
    ['htimeout', 'Home<br>Timeout<br>T.O.L.', '', 'blue'], ['vtimeout', 'Visitor<br>Timeout<br>T.O.L.', '', 'yellow'], ['minus1', '-1', 'Blank'],
    ['bridim', 'Bri.<br>Dim'], ['hsog', 'Home<br>S.O.G.', '', 'blue'], ['vsog', 'Visitor<br>S.O.G.', '', 'yellow'], ['setint', 'Set<br>Interval', 'On/Off'],
    ['hpen', 'Home<br>Penalty', '', 'blue'], ['vpen', 'Visitor<br>Penalty', '', 'yellow'], ['plus3', '+3<span class="sticker" id="sticker3"></span>'],
    [null], ['hgoal', 'Home<br>Goal', '', 'blue'], ['vgoal', 'Visitor<br>Goal', '', 'yellow'], [null], [null], [null], ['plus2', '+2<br>5:00'],
    [null], [null], [null], [null], ['hscore', 'Home<br>Score', '', 'blue'], ['vscore', 'Visitor<br>Score', '', 'yellow'], ['plus1', '+1<br>2:00']
  ];
  var NUM = [
    ['d7', '7'], ['d8', '8<span class="arrow">&#9650;</span>'], ['d9', '9'],
    ['d4', '4', 'Yes'], ['d5', '5', 'Next'], ['d6', '6', 'No'],
    ['d1', '1'], ['d2', '2<span class="arrow">&#9660;</span>'], ['d3', '3'],
    ['clr', 'CLR', 'Esc'], ['d0', '0'], ['enter', 'Enter']
  ];
  function keyHTML(k, extraCls) {
    if (!k[0]) return '<span class="key black" aria-hidden="true"></span>';
    var sub = k[2] ? '<span class="sub">' + k[2] + '</span>' : '';
    var label = (KL[k[0]] ? KL[k[0]][0] : k[0].slice(1)) + (k[2] ? ' (' + k[2] + ')' : '');
    return '<button type="button" class="key ' + (k[3] || extraCls || '') + (sub ? ' has-sub' : '') + '" data-key="' + k[0] + '" aria-label="' + label + '"><span>' + k[1] + '</span>' + sub + '</button>';
  }
  var consoleEl = $('#console');
  consoleEl.innerHTML =
    '<div class="face">' +
    '<div class="plate"><b>MP-70 &middot; HK</b><span>Practice console</span></div>' +
    '<div class="lcdbox"><div class="lcd" id="lcd" role="status" aria-label="Console screen"></div></div>' +
    '<div class="ledbox">AUTO HORN<span class="led" id="led"></span>ON</div>' +
    '<div class="fn">' + FN.map(function (k) { return keyHTML(k); }).join('') + '</div>' +
    '<div class="num">' + NUM.map(function (k) { return keyHTML(k, k[0] === 'enter' ? 'white enter' : 'white'); }).join('') +
    '<button type="button" class="key shiftkey" data-key="shift" aria-label="Shift">Shift</button></div>' +
    '<div class="side"><span class="mobile-led">AUTO HORN <span class="led" id="led2"></span></span>' +
    '<span class="lbl">HORN</span><button type="button" class="hornbtn" data-key="horn" aria-label="Horn"></button>' +
    '<span class="lbl">TIME IN</span><button type="button" class="rocker" data-key="timein" aria-label="Time in switch" aria-pressed="false"><i></i></button>' +
    '<span class="rstate" id="rstate">Clock stopped</span></div>' +
    '</div>';
  var lcdEl = $('#lcd'), ledEl = $('#led'), led2El = $('#led2'), rockerEl = $('[data-key="timein"]', consoleEl),
    rstateEl = $('#rstate'), shiftEl = $('[data-key="shift"]', consoleEl), hornEl = $('[data-key="horn"]', consoleEl);
  $('#sticker3').textContent = ('0' + fmt(cfg.pen3)).slice(-5);

  function flash(key) {
    var el = $('[data-key="' + key + '"]', consoleEl);
    if (!el || key === 'timein') return;
    el.classList.add('pressed');
    setTimeout(function () { el.classList.remove('pressed'); }, 110);
  }

  function doKey(key) {
    if (explain) { explainKey = key; renderPanel(); return; }
    audio();
    if (key === 'timein') E.setTimeIn(sim, !sim.timeIn);
    else if (key !== 'horn') E.press(sim, key);
    flash(key);
    checkLesson();
    render();
  }

  consoleEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-key]');
    if (!b || b.dataset.key === 'horn') return;
    doKey(b.dataset.key);
    if (e.detail > 0) b.blur(); // keep space bar free for TIME IN after mouse clicks
  });
  function hornOn(e) { if (explain) { if (e.type === 'pointerdown') doKey('horn'); return; } audio(); E.hornDown(sim); hornEl.classList.add('held'); }
  function hornOff() { E.hornUp(sim); hornEl.classList.remove('held'); }
  hornEl.addEventListener('pointerdown', hornOn);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { hornEl.addEventListener(t, hornOff); });
  hornEl.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hornOn(e); } });
  hornEl.addEventListener('keyup', hornOff);

  document.addEventListener('keydown', function (e) {
    if (['lessons', 'drills', 'free'].indexOf(tab) < 0 || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t.closest && t.closest('input, select, textarea, a, button')) return;
    var k = null;
    if (e.key === ' ') k = 'timein';
    else if (/^[0-9]$/.test(e.key)) k = 'd' + e.key;
    else if (e.key === 'Enter') k = 'enter';
    else if (e.key === 'Backspace') k = 'clr';
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
    '<div class="blabel"><span class="lamp" id="lampH"></span>HOME</div>' +
    '<div class="clockbox"><div class="clock-digits" id="b-clock"></div><div class="small-label">PERIOD</div><div class="period-digits" id="b-period"></div><span class="horn" id="b-horn">HORN</span></div>' +
    '<div class="blabel">VISITOR<span class="lamp" id="lampV"></span></div>' +
    '<div class="cell score-digits" id="b-Hscore"></div>' +
    '<div class="cell score-digits" id="b-Vscore"></div>' +
    '<div class="cell"><div class="small-label">SHOTS</div><div class="sog-digits" id="b-Hsog"></div></div>' +
    '<div></div>' +
    '<div class="cell"><div class="small-label">SHOTS</div><div class="sog-digits" id="b-Vsog"></div></div>' +
    '<div class="pens">' + pensHTML('H') + '</div><div></div><div class="pens">' + pensHTML('V') + '</div>' +
    '</div>';
  var B = {};
  ['clock', 'period', 'horn', 'Hscore', 'Vscore', 'Hsog', 'Vsog', 'Hwait', 'Vwait', 'Hp0', 'Hp1', 'Ht0', 'Ht1', 'Vp0', 'Vp1', 'Vt0', 'Vt1'].forEach(function (id) { B[id] = $('#b-' + id); });
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
  function render() {
    var l = E.lcd(sim);
    var txt = l[0] + '\n' + l[1];
    if (lcdEl.textContent !== txt) lcdEl.textContent = txt;
    ledEl.classList.toggle('on', sim.autoHorn); led2El.classList.toggle('on', sim.autoHorn);
    rockerEl.classList.toggle('on', sim.timeIn); rockerEl.setAttribute('aria-pressed', String(sim.timeIn));
    rstateEl.classList.toggle('on', sim.timeIn);
    rstateEl.textContent = sim.timeIn ? (sim.clock > 0 || !sim.countDown ? 'Clock running' : 'On, at 0:00') : 'Clock stopped';
    shiftEl.classList.toggle('on', sim.shift);

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

  var LESSONS = [
    {
      id: 'meet', title: 'Meet the console', sub: 'Where everything is',
      intro: function () { return 'This is the console in the scorekeeper\'s box. Everything you press shows up on the big scoreboard above it. You only need about a dozen of these keys.'; },
      setup: function (s) { midGame(s, { clock: cfg.periodLen }); },
      steps: [
        { t: 'Find the <b>TIME IN</b> switch on the right side. It starts and stops the game clock. Flip it on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
        { t: 'The game clock on the scoreboard is counting down. Flip <b>TIME IN</b> off to stop it.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Blue keys are always the <b>home</b> team. Press <b>HOME SCORE</b> and look at the small screen: it now says H.SCORE and shows the score.', keys: ['hscore'], check: function (s) { return inMode(s, 'score', 'H'); } },
        { t: 'Yellow keys are always the <b>visitor</b> team. Press <b>VISITOR S.O.G.</b> (shots on goal).', keys: ['vsog'], check: function (s) { return inMode(s, 'sog', 'V'); } },
        { t: 'The green labels are each key\'s second job. You reach them with <b>SHIFT</b>. Press SHIFT now. It lights up.', keys: ['shift'], check: function (s) { return s.shift; } },
        { t: 'Now press <b>CLR</b>. With SHIFT, CLR becomes ESC, which backs out of whatever you were doing. The screen goes back to "- HOCKEY -".', keys: ['clr'], check: function (s) { return !s.shift && !s.mode; } }
      ],
      wrap: 'You know the layout. Next is running the clock, which is most of the job.'
    },
    {
      id: 'clock', title: 'Start and stop the clock', sub: 'The skill that matters most',
      intro: function () { return 'The clock runs only while the puck is in play. Keep your eyes on the referee, not on the console. Your hand stays on the switch.'; },
      setup: function (s) { midGame(s, { clock: cfg.periodLen, hs: 0, vs: 0 }); },
      steps: [
        { t: 'The referee drops the puck for the opening faceoff. Flip <b>TIME IN</b> on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
        { t: 'Whistle! The puck flew over the glass. Flip <b>TIME IN</b> off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Faceoff. Clock on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
        { t: 'Whistle for offside. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Start the clock when the puck leaves the referee\'s hand, not when the players line up. Clock on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
        { t: 'Whistle. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } }
      ],
      wrap: 'Each second you are late is a second added to or taken from the game. The Practice tab has a reaction drill for exactly this. On a computer, the space bar flips TIME IN.'
    },
    {
      id: 'setclock', title: 'Set the period clock', sub: 'Before every period',
      intro: function () { return 'Before each period you set the clock to ' + fmt(cfg.periodLen) + '. The console will not let you change the clock while TIME IN is on.'; },
      setup: function (s) { s.clock = 0; s.timeIn = true; },
      steps: [
        { t: 'Someone left the <b>TIME IN</b> switch on. Flip it off first.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Press <b>CLOCK SET</b>. The screen shows SET CLK. and a time.', keys: ['clockset'], check: function (s) { return inMode(s, 'clockset') && s.mode.which === 0; } },
        { t: function () { return 'Type the period length without the colon: <b>' + timeDigits(cfg.periodLen) + '</b> for ' + fmt(cfg.periodLen) + '.'; }, keys: function () { return timeKeys(cfg.periodLen); }, check: function (s) { return inMode(s, 'clockset') && s.mode.entry && E.entryMs(s.mode.entry) === cfg.periodLen * SEC; } },
        { t: 'Press <b>ENTER</b>. The scoreboard shows the new time.', keys: ['enter'], check: function (s) { return s.clock === cfg.periodLen * SEC && !inMode(s, 'clockset'); } }
      ],
      wrap: 'Typed a wrong digit? Press CLR and type it again before ENTER. Pressing CLOCK SET more than once switches to the break clock (SET BRK.) and overtime clock (SET O.T.). You will rarely need those.'
    },
    {
      id: 'goal', title: 'Record a goal', sub: 'And the key that looks like it but isn\'t',
      intro: function () { return 'When a goal is scored, the referee blows the whistle and points at the net.'; },
      setup: function (s) { midGame(s, { running: true }); },
      steps: [
        { t: 'Whistle. Home scored! Stop the clock first.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Press <b>HOME SCORE</b>, then <b>+1</b>. The red goal light flashes by itself.', keys: ['hscore', 'plus1'], check: function (s, p) { return s.H.score === p.H.score + 1; } },
        { t: 'A goal also counts as a shot on goal. Press <b>HOME S.O.G.</b>, then <b>+1</b>.', keys: ['hsog', 'plus1'], check: function (s, p) { return s.H.sog === p.H.sog + 1; } },
        { t: 'Later, the visitors score. Press <b>VISITOR SCORE</b>, then <b>+1</b>.', keys: ['vscore', 'plus1'], check: function (s, p) { return s.V.score === p.V.score + 1; } },
        { t: 'Now a trap. Press <b>HOME GOAL</b>. The red light turns on but the score does not change. HOME GOAL only controls the light.', keys: ['hgoal'], start: function (s) { s.H.goalMs = 0; s.V.goalMs = 0; }, check: function (s) { return s.H.goalManual; } },
        { t: 'Press <b>HOME GOAL</b> again to turn the light off. For goals, always use HOME SCORE.', keys: ['hgoal'], check: function (s) { return !s.H.goalManual && s.H.goalMs === 0; } }
      ],
      wrap: 'Goal = clock off, SCORE +1, S.O.G. +1. Added it to the wrong team? The next lesson shows the fix.'
    },
    {
      id: 'fixscore', title: 'Fix a wrong number', sub: 'Score, shots or period',
      intro: function () { return 'Mistakes happen to everyone. The referee will tell you what the board should say.'; },
      setup: function (s) { midGame(s, { h: 3, v: 1, hs: 8 }); },
      steps: [
        { t: 'The board shows Home 3, but the ref says it should be 2. Press <b>HOME SCORE</b>, then <b>-1</b>.', keys: ['hscore', 'minus1'], check: function (s) { return s.H.score === 2; } },
        { t: 'You can also type the number. Visitor should have 2: press <b>VISITOR SCORE</b>, type <b>2</b>, press <b>ENTER</b>.', keys: ['vscore', 'd2', 'enter'], check: function (s) { return s.V.score === 2; } },
        { t: 'Shots work the same way. Home should have 10: <b>HOME S.O.G.</b>, type <b>1 0</b>, press <b>ENTER</b>.', keys: ['hsog', 'd1', 'd0', 'enter'], check: function (s) { return s.H.sog === 10; } }
      ],
      wrap: '+1 and -1 nudge a number up or down. Typing a number and pressing ENTER replaces it. Both work for score, shots and period.'
    },
    {
      id: 'shots', title: 'Count shots on goal', sub: 'While the clock keeps running',
      intro: function () { return 'Shots happen often and the clock keeps running. A shot counts only if the goalie stops it or it goes in.'; },
      setup: function (s) { midGame(s, { running: true, hs: 3, vs: 2 }); },
      steps: [
        { t: 'Home shoots, the goalie catches it, play goes on. Press <b>HOME S.O.G.</b>, then <b>+1</b>.', keys: ['hsog', 'plus1'], check: function (s, p) { return s.H.sog === p.H.sog + 1; } },
        { t: 'Another home shot, saved. The screen still says H.S.O.GOAL, so you can just press <b>+1</b> again.', keys: ['plus1'], check: function (s, p) { return s.H.sog === p.H.sog + 1; } },
        { t: 'Visitor shot, saved. Press <b>VISITOR S.O.G.</b>, then <b>+1</b>.', keys: ['vsog', 'plus1'], check: function (s, p) { return s.V.sog === p.V.sog + 1; } },
        { t: 'The goalie covers the puck and the ref whistles. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } }
      ],
      wrap: 'Missed nets, blocked shots and shots off the post are not shots on goal. If you are unsure, check with the official scorer between periods.'
    },
    {
      id: 'minor', title: 'Enter a penalty', sub: 'The four-key sequence',
      intro: function () { return 'The referee signals a penalty: Visitor #7, tripping, a ' + minorStr() + ' minor. Play already stopped, so the clock is off.'; },
      setup: function (s) { midGame(s, { h: 1 }); },
      steps: [
        { t: 'Press <b>VISITOR PENALTY</b>.', keys: ['vpen'], check: function (s) { return inMode(s, 'pen', 'V'); } },
        { t: function () { return 'Press <b>' + KL[minorKey()][0] + '</b> for ' + minorStr() + '. ' + (minorKey() === 'plus3' ? 'That is the key with the 01:30 sticker.' : 'The +1 key enters 2:00.') + ' The screen now asks ENTER PLY.NO. (player number).'; }, keys: function () { return [minorKey()]; }, check: function (s) { return inMode(s, 'pen', 'V') && s.mode.adds.indexOf(cfg.minor * SEC) >= 0; } },
        { t: 'Type the player number: <b>7</b>.', keys: ['d7'], check: function (s) { return inMode(s, 'pen', 'V') && s.mode.entry === '7'; } },
        { t: 'Press <b>ENTER</b>. Player 7 and the penalty time appear on the scoreboard.', keys: ['enter'], check: function (s) { return hasPen(s, 'V', 7); } },
        { t: 'Puck drop. Flip <b>TIME IN</b> on and watch the penalty clock count down with the game clock.', keys: ['timein'], check: function (s) { return s.timeIn; } },
        { t: 'Whistle. Clock off. The penalty clock stops too.', keys: ['timein'], check: function (s) { return !s.timeIn; } }
      ],
      wrap: 'Order matters: PENALTY, time key, player number, ENTER. If you press ENTER before typing the number, the screen says NO PENALTY FOUND and nothing is saved. Just start over.'
    },
    {
      id: 'pp', title: 'Power-play goal', sub: 'Clearing a penalty early',
      intro: function () { return 'Visitor #7 is in the penalty box, so Home has an extra skater. That is a power play.'; },
      setup: function (s) { midGame(s, { running: true, h: 1, v: 1 }); E.addPenalty(s, 'V', '7', cfg.minor * SEC); s.V.pens[0].left = 52 * SEC; },
      steps: [
        { t: 'Whistle. Home scores on the power play! Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Add the goal: <b>HOME SCORE</b>, then <b>+1</b>.', keys: ['hscore', 'plus1'], check: function (s, p) { return s.H.score === p.H.score + 1; } },
        { t: 'A power-play goal ends #7\'s minor, but the console will not clear it for you. Press <b>VISITOR PENALTY</b>, type <b>7</b>, press <b>ENTER</b>.', keys: ['vpen', 'd7', 'enter'], check: function (s) { return inMode(s, 'penedit', 'V'); } },
        { t: 'The screen shows #7 and the time left. Press <b>ENTER</b> again to clear it.', keys: ['enter'], check: function (s) { return !hasPen(s, 'V', 7); } }
      ],
      wrap: 'Only a minor ends early. A 5:00 major stays on even if the other team scores. If two players are serving minors, clear the one whose penalty started first.'
    },
    {
      id: 'morepens', title: 'More penalty situations', sub: 'Majors, a waiting penalty, the list',
      intro: function () { return 'Each team shows two penalties at a time. The console stores up to three more and starts them as the first two run out.'; },
      setup: function (s) { midGame(s, {}); E.addPenalty(s, 'V', '7', cfg.minor * SEC); s.V.pens[0].left = 70 * SEC; E.addPenalty(s, 'V', '12', cfg.minor * SEC); },
      steps: [
        { t: function () { return 'Visitor #22 also gets a ' + minorStr() + ' minor. Enter it: <b>VISITOR PENALTY</b>, <b>' + KL[minorKey()][0] + '</b>, <b>2 2</b>, <b>ENTER</b>.'; }, keys: function () { return ['vpen', minorKey(), 'd2', 'd2', 'enter']; }, check: function (s) { return hasPen(s, 'V', 22); } },
        { t: 'Only #7 and #12 show on the board. #22 is waiting. Flip <b>TIME IN</b> on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
        { t: 'Whistle. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Now a major: Home #4, 5:00 for checking from behind. <b>HOME PENALTY</b>, <b>+2</b> (5:00), <b>4</b>, <b>ENTER</b>.', keys: ['hpen', 'plus2', 'd4', 'enter'], check: function (s) { return hasPen(s, 'H', 4, 300 * SEC); } },
        { t: 'To see every penalty a team has had, press <b>SHIFT</b>, then <b>VISITOR PENALTY</b>. Do it again to scroll through the list.', keys: ['shift', 'vpen'], check: function (s) { return inMode(s, 'track', 'V'); } }
      ],
      wrap: function () { return 'A double minor (two minors on one player): press the time key twice before the number, for example ' + KL[minorKey()][0] + ', ' + KL[minorKey()][0] + '. The console adds the two times together.'; }
    },
    {
      id: 'fixclock', title: 'Fix the clock', sub: 'When the ref wants time back',
      intro: function () { return 'The referee says the clock ran 3 seconds too long. It shows 8:15 and should show 8:18.'; },
      setup: function (s) { midGame(s, { clock: 495, h: 2, v: 2 }); E.addPenalty(s, 'V', '9', cfg.minor * SEC); s.V.pens[0].left = 61 * SEC; },
      steps: [
        { t: 'TIME IN is already off. Press <b>CLOCK SET</b>.', keys: ['clockset'], check: function (s) { return inMode(s, 'clockset'); } },
        { t: 'Type <b>8 1 8</b>.', keys: ['d8', 'd1', 'd8'], check: function (s) { return inMode(s, 'clockset') && s.mode.entry && E.entryMs(s.mode.entry) === 498 * SEC; } },
        { t: 'Press <b>ENTER</b>.', keys: ['enter'], check: function (s) { return s.clock === 498 * SEC; } },
        { t: 'The screen asks CORR.PENALTY?Y/N: do you want to change the penalty times too? Usually not. Press <b>SHIFT</b>, then <b>6</b> (NO).', keys: ['shift', 'd6'], check: function (s) { return !s.mode && s.clock === 498 * SEC; } }
      ],
      wrap: 'Answer YES (SHIFT + 4) only when the ref gives new penalty times too. The console then shows each penalty in turn. Type its new time and press ENTER.'
    },
    {
      id: 'endperiod', title: 'End a period', sub: 'Horn, next period, reset the clock',
      intro: function () { return 'The period ends when the clock hits zero. The AUTO HORN light is on, so the horn sounds by itself.'; },
      setup: function (s) { midGame(s, { clock: 7, running: true, h: 2, v: 1 }); },
      steps: [
        { t: 'Let the clock run out and listen for the horn.', keys: [], check: function (s) { return s.clock === 0; } },
        { t: 'Flip <b>TIME IN</b> off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Change the period: <b>PERIOD</b>, then <b>+1</b>.', keys: ['period', 'plus1'], check: function (s) { return s.period === 2; } },
        { t: function () { return 'Set the clock for period 2: <b>CLOCK SET</b>, type <b>' + timeDigits(cfg.periodLen) + '</b>, <b>ENTER</b>.'; }, keys: function () { return ['clockset'].concat(timeKeys(cfg.periodLen), ['enter']); }, check: function (s) { return s.clock === cfg.periodLen * SEC && s.periodType === 'game' && !inMode(s, 'clockset'); } }
      ],
      wrap: 'Penalties still running carry into the next period. Leave them. If your rink runs an intermission countdown, press CLOCK SET twice to reach SET BRK.'
    },
    {
      id: 'timeout', title: 'Timeouts', sub: 'Stop, charge the team, start the timer',
      intro: function () { return 'Each team usually gets one timeout per game. When a coach calls one, play stops.'; },
      setup: function (s) { midGame(s, { running: true }); },
      steps: [
        { t: 'Whistle: Home calls a timeout. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
        { t: 'Press <b>HOME TIMEOUT</b>. The screen shows the timeout length and how many Home has left.', keys: ['htimeout'], check: function (s) { return inMode(s, 'timeout', 'H'); } },
        { t: 'Press <b>-1</b>. That starts the timeout countdown on the screen and uses up one of Home\'s timeouts.', keys: ['minus1'], check: function (s, p) { return !!s.timeout && s.H.tol === p.H.tol - 1; } },
        { t: 'The teams line up for the faceoff. Flip <b>TIME IN</b> on.', keys: ['timein'], check: function (s) { return s.timeIn; } }
      ],
      wrap: 'Many youth games do not run the timeout timer. Ask your rink if they want you to use it.'
    },
    {
      id: 'newgame', title: 'Start a new game', sub: 'Clear the last game first',
      intro: function () { return 'The console remembers the last game, even after being switched off. Clear it before you start yours.'; },
      setup: function (s) { midGame(s, { clock: 0, period: 3, h: 4, v: 2, hs: 21, vs: 17 }); E.addPenalty(s, 'H', '11', cfg.minor * SEC); },
      steps: [
        { t: 'Press <b>SHIFT</b>, then <b>PERIOD</b>. The green label under PERIOD says NEW GAME.', keys: ['shift', 'period'], check: function (s) { return inMode(s, 'yesno') && s.mode.q.indexOf('NEW GAME') === 0; } },
        { t: 'The screen asks NEW GAME? Y/N. Press <b>SHIFT</b>, then <b>4</b> (YES).', keys: ['shift', 'd4'], check: function (s) { return s.H.score === 0 && s.V.score === 0 && s.period === 1 && !s.H.pens.length; } }
      ],
      wrap: function () { return 'The clock goes back to the stored period length. On the real console, check that it shows ' + fmt(cfg.periodLen) + '. If not, set it with CLOCK SET. Then you are ready for puck drop.'; }
    }
  ];
  function val(x) { return typeof x === 'function' ? x() : x; }

  function openLesson(i) {
    var def = LESSONS[i];
    sim = E.newGame(cfg);
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
          doneLessons[lesson.def.id] = true; save('done', doneLessons);
          setHints(null);
        } else startStep();
        renderPanel();
      }, 700);
    }
  }

  /* ---------- drills ---------- */
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
    var team = T === 'H' ? 'Home' : 'Visitor', key = ms === cfg.minor * SEC ? minorKey() : ms === 300 * SEC ? 'plus2' : 'plus1';
    return ev({ cue: 'Whistle: penalty', cls: 'whistle', sound: 'whistle', wait: wait || rnd(3000, 6000),
      detail: team + ' #' + p + ', ' + why + ', ' + E.fmt(ms) + '. Stop the clock and enter it.',
      keys: ['timein', T === 'H' ? 'hpen' : 'vpen', key].concat(numKeys(p), ['enter']),
      check: function (s) { return !s.timeIn && hasPen(s, T, p, ms); },
      fix: function (s) { E.setTimeIn(s, false); if (!hasPen(s, T, p)) E.addPenalty(s, T, String(p), ms); s.mode = null; } });
  }
  function goalEv(T, p, wait, extra) {
    var team = T === 'H' ? 'Home' : 'Visitor', t = T.toLowerCase();
    return ev({ cue: 'Whistle: goal!', cls: 'whistle', sound: 'whistle', wait: wait || rnd(3000, 6000),
      detail: team + ' #' + p + ' scores' + (extra || '') + '. Stop the clock, add the goal and the shot.',
      keys: ['timein', t + 'score', 'plus1', t + 'sog', 'plus1'],
      check: function (s, q) { return !s.timeIn && s[T].score === q[T].score + 1 && s[T].sog === q[T].sog + 1; },
      fix: function (s, q) { E.setTimeIn(s, false); s[T].score = q[T].score + 1; s[T].sog = q[T].sog + 1; s.mode = null; } });
  }
  function shotEv(T, wait) {
    var team = T === 'H' ? 'Home' : 'Visitor', t = T.toLowerCase();
    return ev({ cue: 'Shot on goal', wait: wait || rnd(2500, 5000), detail: team + ' shoots, the goalie makes the save, play goes on. Count the shot.',
      keys: [t + 'sog', 'plus1'], limit: 15000,
      check: function (s, q) { return s[T].sog === q[T].sog + 1; },
      fix: function (s, q) { s[T].sog = q[T].sog + 1; } });
  }
  function clearEv(T, p, why) {
    var t = T.toLowerCase();
    return ev({ cue: 'Power-play goal', wait: 900, detail: why,
      keys: [t + 'pen'].concat(numKeys(p), ['enter', 'enter']),
      check: function (s) { return !hasPen(s, T, p); },
      fix: function (s) { var x = E.findPen(s, T, p); if (x) s[T].pens.splice(s[T].pens.indexOf(x), 1); s.mode = null; } });
  }
  function refEv(detail, keys, check, fix, wait) {
    return ev({ cue: 'Ref says', wait: wait || 1400, limit: 40000, detail: detail, keys: keys, check: check, fix: fix });
  }

  var DRILLS = [
    {
      id: 'react', title: 'Whistle and faceoff', sub: '12 cues. Only the TIME IN switch. Measures your reaction time.',
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
          clearEv('V', p1, 'Home scored while Visitor #' + p1 + ' was in the box. Clear #' + p1 + '\'s minor.'),
          drop(),
          ev({ cue: 'End of period', wait: 2500, limit: 20000, detail: 'Skipping ahead to the last seconds. Let the clock run out.', keys: [],
            pre: function (s) { if (!s.timeIn) E.setTimeIn(s, true); s.clock = Math.min(s.clock, 6 * SEC); },
            check: function (s) { return s.clock === 0; }, fix: function (s) { s.clock = 0; } }),
          ev({ cue: 'Intermission', wait: 1500, limit: 50000, detail: 'Get ready for period 2: clock off, period up by one, clock set to ' + fmt(cfg.periodLen) + '.',
            keys: ['timein', 'period', 'plus1', 'clockset'].concat(timeKeys(cfg.periodLen), ['enter']),
            check: function (s, q) { return !s.timeIn && s.period === q.period + 1 && s.clock === cfg.periodLen * SEC && s.periodType === 'game'; },
            fix: function (s, q) { E.setTimeIn(s, false); s.period = q.period + 1; s.clock = cfg.periodLen * SEC; s.periodType = 'game'; s.mode = null; } })
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
        return [
          refEv('That last home goal was waved off. Home should have 2.', ['hscore', 'minus1'],
            function (s) { return s.H.score === 2; }, function (s) { s.H.score = 2; s.mode = null; }, 1200),
          refEv('Visitor #7 got a minor, not a major. Change it to ' + minorStr() + '.', ['vpen', 'd7', 'enter'].concat(timeKeys(cfg.minor), ['enter']),
            function (s) { var x = E.findPen(s, 'V', 7); return !!x && Math.abs(x.left - cfg.minor * SEC) < SEC; },
            function (s) { var x = E.findPen(s, 'V', 7); if (x) { x.left = cfg.minor * SEC; x.total = x.left; } s.mode = null; }),
          refEv('The board says period 3. It is period 2.', ['period', 'minus1'],
            function (s) { return s.period === 2; }, function (s) { s.period = 2; s.mode = null; }),
          refEv('Put 3 seconds back: the clock should read 8:18. Keep the penalty times as they are.', ['clockset', 'd8', 'd1', 'd8', 'enter', 'shift', 'd6'],
            function (s) { return s.clock === 498 * SEC && !s.mode; }, function (s) { s.clock = 498 * SEC; s.mode = null; }),
          refEv('Visitor should have 12 shots, not 11.', ['vsog', 'plus1'],
            function (s) { return s.V.sog === 12; }, function (s) { s.V.sog = 12; s.mode = null; }),
          drop(2000)
        ];
      }
    }
  ];

  function startDrill(i) {
    audio();
    var def = DRILLS[i];
    sim = E.newGame(cfg);
    def.setup(sim);
    drill = { def: def, events: def.build(), idx: -1, phase: 'wait', until: 0, t0: 0, results: [], snap: null, last: null };
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
      drill.t0 = now;
      drill.phase = 'active';
      if (e.sound === 'whistle') whistle(); else if (e.sound === 'drop') thud();
      setHints(drillHints ? e.keys : null);
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
    drill.last = { ok: ok, e: e, ms: now - drill.t0 };
    drill.phase = 'feedback';
    drill.until = now + (ok ? 900 : 3600);
    setHints(ok ? null : e.keys);
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
      var info = explain && explainKey && INFO[explainKey];
      h = info ? '<b class="lbl">' + info[0] + '</b>' + info[1] : explain ? 'Tap any key to see what it does.' : '<b class="lbl">Free play</b>Press anything. Options are below the console.';
    }
    nowbar.innerHTML = h + '<span class="nowcoach"></span>';
  }

  // Sidebars are one bordered box, like the home page grid: each direct child of .card is a
  // cell or an edge-to-edge list, and every rule between them runs to the outer border.
  function coachCell() {
    return '<div class="pcell coachcell"><p class="tip warn coach" id="coach">' + (sim.coach || '') + '</p></div>';
  }

  function lessonPanel() {
    if (!lesson) {
      var count = LESSONS.filter(function (l) { return doneLessons[l.id]; }).length;
      return '<div class="card"><div class="pcell"><div class="eyebrow">Lessons</div><h2>Learn one job at a time</h2>' +
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
      return '<div class="card"><div class="pcell"><div class="eyebrow">Practice</div><h2>Run a fake game</h2>' +
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
        : '<div class="pcell feedback miss"><b>Out of time.</b><span>The keys were: </span><span class="seq">' + chips(drill.last.e.keys.length ? drill.last.e.keys : []) + '</span><span>The board has been fixed so the game can continue.</span></div>';
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
    var info = explainKey && INFO[explainKey];
    return '<div class="card"><div class="pcell"><div class="eyebrow">Free play</div><h2>Try anything</h2>' +
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
    else if (a === 'fresh') { sim = E.newGame(cfg); renderPanel(); }
  });
  panel.addEventListener('change', function (e) {
    if (e.target.id === 'hint-toggle') { showHints = e.target.checked; save('hints', showHints); if (lesson && !lesson.finished) setHints(showHints ? val(lesson.def.steps[lesson.step].keys) : null); }
    if (e.target.id === 'dhint-toggle') { drillHints = e.target.checked; save('drillHints', drillHints); }
    if (e.target.id === 'explain-toggle') { explain = e.target.checked; consoleEl.classList.toggle('explaining', explain); explainKey = null; renderPanel(); }
  });

  function loadSample() {
    sim = E.newGame(cfg);
    midGame(sim, { period: 2, clock: Math.min(522, cfg.periodLen - 60), h: 3, v: 2, hs: 14, vs: 11 });
    E.addPenalty(sim, 'V', '7', cfg.minor * SEC); sim.V.pens[0].left = 64 * SEC;
    E.addPenalty(sim, 'H', '18', 300 * SEC); sim.H.pens[0].left = 211 * SEC;
  }

  /* ---------- cheat sheet ---------- */
  function renderSheet() {
    var mk = minorKey(), dbl = [mk, mk];
    function rows(list) { return '<table>' + list.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + seq(r[1]) + (r[2] ? '<div class="muted" style="font-size:13px;margin-top:4px">' + r[2] + '</div>' : '') + '</td></tr>'; }).join('') + '</table>'; }
    $('#sheet').innerHTML =
      '<div class="sheet-head"><div class="eyebrow">Keep this open in the scorer\'s box</div><h1>Cheat sheet</h1>' +
      '<p class="muted">Your rules: ' + fmt(cfg.periodLen) + ' periods, ' + minorStr() + ' minors (' + KL[mk][0] + ' key), 5:00 majors (+2 key). Blue keys are home, yellow keys are visitor. "Shift +" means hold SHIFT, then press the key. Take a screenshot to keep it on your phone.</p></div>' +
      '<div class="sheet-grid boxgrid">' +
      '<div class="sheet-card"><h2>Every whistle</h2>' + rows([
        ['Puck drops', ['timein'], 'Switch ON. Clock runs.'],
        ['Whistle', ['timein'], 'Switch OFF. Clock stops.'],
        ['Horn by hand', ['horn'], 'Hold it down.']
      ]) + '</div>' +
      '<div class="sheet-card"><h2>Goals and shots</h2>' + rows([
        ['Home goal', ['timein', 'hscore', 'plus1', 'hsog', 'plus1'], 'Clock off, goal, then shot.'],
        ['Visitor goal', ['timein', 'vscore', 'plus1', 'vsog', 'plus1']],
        ['Shot on goal (clock keeps running)', ['hsog', 'plus1']],
        ['Take a goal away', ['hscore', 'minus1']],
        ['Type an exact score', ['hscore', 'd3', 'enter'], 'Same for S.O.G. and PERIOD.'],
        ['Never use for goals', ['hgoal'], 'Only switches the red light.']
      ]) + '</div>' +
      '<div class="sheet-card"><h2>Penalties</h2>' + rows([
        ['Minor ' + minorStr() + ', Visitor #7', ['vpen', mk, 'd7', 'enter']],
        ['Major 5:00, Home #4', ['hpen', 'plus2', 'd4', 'enter']],
        ['Double minor, #12', ['vpen'].concat(dbl, ['d1', 'd2', 'enter']), 'Press the time key twice.'],
        ['Power-play goal: clear #7', ['vpen', 'd7', 'enter', 'enter'], 'Minors only. Majors stay.'],
        ['Change a penalty time', ['vpen', 'd7', 'enter', 'd1', 'd0', 'd0', 'enter'], 'Type the new time (100 = 1:00).'],
        ['List all penalties', ['shift', 'vpen'], 'Press again to scroll.']
      ]) + '</div>' +
      '<div class="sheet-card"><h2>Clock and periods</h2>' + rows([
        ['Next period', ['period', 'plus1']],
        ['Set the clock to ' + fmt(cfg.periodLen), ['clockset'].concat(timeKeys(cfg.periodLen), ['enter']), 'TIME IN must be off.'],
        ['Fix the clock (8:18)', ['clockset', 'd8', 'd1', 'd8', 'enter']],
        ['...then keep penalty times', ['shift', 'd6'], 'Answers NO to CORR.PENALTY?'],
        ['Home timeout', ['timein', 'htimeout', 'minus1']]
      ]) + '</div>' +
      '<div class="sheet-card"><h2>Start and oops</h2>' + rows([
        ['New game (clears all)', ['shift', 'period', 'shift', 'd4']],
        ['Typed a wrong digit', ['clr'], 'Before ENTER. After ENTER, just enter it again.'],
        ['Stuck in a question', ['shift', 'clr'], 'ESC backs out.']
      ]) + '</div>' +
      '<div class="sheet-card"><h2>Screen messages</h2><p class="sheet-note">These show up on the small green screen above the number keys. Here they look the same as on the console.</p><table class="lcd-table">' +
      [['HK', 'Hockey mode. BK means the break clock, OT overtime.'],
       ['ENTER PLY.NO.', 'Type the player number, then ENTER.'],
       ['NO PENALTY FOUND', 'ENTER was pressed before the number, or that player has no penalty. Start the penalty again.'],
       ['CORR.PENALTY?Y/N', 'You changed the clock while penalties run. SHIFT + 6 (NO) keeps them.'],
       ['NEW GAME? Y/N', 'SHIFT + 4 (YES) clears everything. SHIFT + 6 cancels.'],
       ['T.O.D.CLOCK? Y/N', 'Time of day. SHIFT + 6 (NO) brings the game clock back.']
      ].map(function (r) { return '<tr><td><code class="lcdchip">' + (r[0] + '                ').slice(0, 16) + '</code></td><td>' + r[1] + '</td></tr>'; }).join('') +
      '</table></div></div>' +
      '<p class="fine">From the Fair-Play MP-70/50 Series User Guide (document 98-0002-29). Unofficial. Check against your rink\'s console before your first game.</p>';
  }

  /* ---------- setup form ---------- */
  var setPeriod = $('#set-period'), setMinor = $('#set-minor'), setTenths = $('#set-tenths');
  function syncForm() { setPeriod.value = String(cfg.periodLen); setMinor.value = String(cfg.minor); setTenths.value = cfg.tenths ? '1' : '0'; }
  syncForm();
  $('#setup-form').addEventListener('change', function () {
    cfg.periodLen = +setPeriod.value; cfg.minor = +setMinor.value; cfg.tenths = setTenths.value === '1';
    save('cfg', { periodLen: cfg.periodLen, minor: cfg.minor, tenths: cfg.tenths });
    sim.cfg = cfg;
    renderSheet();
  });
  $('#setup-form').addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------- tabs ---------- */
  var TABS = ['start', 'lessons', 'drills', 'free', 'cheat'];
  function go(t) {
    if (TABS.indexOf(t) < 0) t = 'start';
    var prev = tab;
    tab = t;
    document.querySelectorAll('nav.tabs a').forEach(function (a) { if (a.dataset.tab === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#view-start').hidden = t !== 'start';
    $('#view-cheat').hidden = t !== 'cheat';
    $('#view-trainer').hidden = ['lessons', 'drills', 'free'].indexOf(t) < 0;
    if (prev === 'drills' && t !== 'drills') { drill = null; }
    if (t !== 'free') { explain = false; consoleEl.classList.remove('explaining'); }
    setHints(null);
    if (t === 'lessons') { if (lesson) { if (!lesson.finished) setHints(showHints ? val(lesson.def.steps[lesson.step].keys) : null); } else sim = E.newGame(cfg); }
    if (t === 'drills' && !drill) sim = E.newGame(cfg);
    if (t === 'free' && prev !== 'free') { loadSample(); lesson = null; }
    if (t === 'cheat') renderSheet();
    hornStop();
    renderPanel();
    render();
    window.scrollTo(0, 0);
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

  renderSheet();
  go(location.hash.slice(1) || 'start');
  setInterval(frame, 50);
})();
