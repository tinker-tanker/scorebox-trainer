/* Scoreboard trainer engine: the shared hockey game core (clock, scores, penalty clocks,
   scoreboard output) plus the Fair-Play MP-70/50 console. Other consoles register their own
   press()/lcd() in Engine.consoles and reuse the core helpers exported below.

   Fair-Play MP-70/50 hockey console emulator.
   Behaviour follows the MP-70/50 Series User Guide (doc 98-0002-29), hockey chapter
   and Common Functions chapter. LCD wording follows the manual where it gives it;
   other screens are close approximations. All times are in milliseconds. */
(function (root) {
  'use strict';

  var SEC = 1000;

  function defaultSettings() {
    return {
      periodLen: 15 * 60,   // seconds
      breakLen: 3 * 60,
      otLen: 5 * 60,
      minor: 90,            // league minor penalty length (seconds)
      major: 300,
      pen1: 120,            // what the +1 key enters as a penalty
      pen2: 300,            // +2
      pen3: 90,             // +3 (reprogrammed to 1:30 on the user's rink console)
      timeoutLen: 30,
      tols: 1,
      tenths: true,
      autoHorn: true,
      intervalLen: 90
    };
  }

  function makeTeam(cfg) {
    return { score: 0, sog: 0, tol: cfg.tols, goalMs: 0, goalManual: false, pens: [], history: [] };
  }

  function newGame(cfg, consoleId) {
    cfg = Object.assign(defaultSettings(), cfg || {});
    return {
      console: consoleId || 'fairplay',
      power: true,
      penPaused: false,
      cfg: cfg,
      clock: cfg.periodLen * SEC,
      timeIn: false,
      countDown: true,
      periodType: 'game',
      period: 1,
      autoHorn: cfg.autoHorn,
      hornMs: 0,
      hornHeld: false,
      H: makeTeam(cfg),
      V: makeTeam(cfg),
      tod: false,
      interval: { on: false, len: cfg.intervalLen * SEC, left: cfg.intervalLen * SEC },
      blank: {},
      shift: false,
      mode: null,
      msg: '',
      coach: '',
      lastField: null,
      timeout: null
    };
  }

  /* ---------- formatting ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmt(ms) {
    var s = Math.ceil(Math.max(0, ms) / SEC);
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  }

  // Digits typed on the keypad are read as MMSS from the right: "130" = 1:30, "1300" = 13:00.
  function entryMs(entry) {
    var e = ('0000' + entry).slice(-4);
    return (parseInt(e.slice(0, 2), 10) * 60 + parseInt(e.slice(2), 10)) * SEC;
  }
  function fmtEntry(entry) {
    var e = ('0000' + entry).slice(-4);
    return parseInt(e.slice(0, 2), 10) + ':' + e.slice(2);
  }

  function clockStr(s) {
    if (s.tod) {
      var d = new Date(), h = d.getHours() % 12 || 12;
      return h + ':' + pad2(d.getMinutes());
    }
    if (s.cfg.tenths && s.countDown && s.clock < 60 * SEC) {
      var t = Math.floor(s.clock / 100);
      return Math.floor(t / 10) + '.' + (t % 10);
    }
    return fmt(s.clock);
  }

  /* ---------- helpers ---------- */

  function other(T) { return T === 'H' ? 'V' : 'H'; }
  function teamOf(key) { return key.charAt(0) === 'h' ? 'H' : 'V'; }
  function activePens(s, T) { return s[T].pens.slice(0, 2); }
  function anyActivePens(s) { return s.H.pens.length > 0 || s.V.pens.length > 0; }

  function addPenalty(s, T, player, ms) {
    if (s[T].pens.length >= 5) return false;     // 2 counting + 3 stored
    s[T].pens.push({ player: String(player), total: ms, left: ms });
    s[T].history.push({ player: String(player), total: ms });
    return true;
  }
  function findPen(s, T, player) {
    var list = s[T].pens;
    for (var i = 0; i < list.length; i++) if (list[i].player === String(player)) return list[i];
    return null;
  }

  function setTimeIn(s, on) {
    s.timeIn = !!on;
    if (!on) s.hornMs = 0;                       // manual: TIME OUT silences the horn
    if (on && s.timeout) s.timeout = null;       // play resumes, timeout is over
  }

  function yesno(s, q, yes, no) { s.mode = { kind: 'yesno', q: q, yes: yes, no: no || function () {} }; }

  var FIELD = {
    score: function (s, T) { return s[T].score; },
    sog: function (s, T) { return s[T].sog; },
    period: function (s) { return s.period; }
  };
  function setField(s, kind, T, v) {
    if (kind === 'period') s.period = Math.max(1, Math.min(9, v));
    else s[T][kind] = Math.max(0, Math.min(99, v));
  }

  /* ---------- key handling ---------- */

  var DIGITS = { d0: '0', d1: '1', d2: '2', d3: '3', d4: '4', d5: '5', d6: '6', d7: '7', d8: '8', d9: '9' };
  var PLUS = { plus1: 1, plus2: 2, plus3: 3, minus1: -1 };
  var MAXLEN = { score: 2, sog: 2, period: 1, clockset: 4, pen: 2, penedit: 4, corredit: 4, inttime: 4 };

  function fpPress(s, key) {
    s.coach = '';
    if (key === 'shift') { s.shift = !s.shift; return; }
    var shifted = s.shift;
    s.shift = false;
    if (shifted && pressShifted(s, key)) return;
    pressPlain(s, key);
  }

  function pressShifted(s, key) {
    var m = s.mode;
    switch (key) {
      case 'd4': // YES
        if (m && m.kind === 'yesno') { s.mode = null; m.yes(); }
        return true;
      case 'd6': // NO
        if (m && m.kind === 'yesno') { s.mode = null; m.no(); }
        return true;
      case 'd5': return true; // NEXT: only used in program mode
      case 'd8': case 'd2': return true;
      case 'clr': // ESC
        s.mode = null; s.msg = ''; return true;
      case 'settimer': // T.O.D.
        yesno(s, 'T.O.D.CLOCK? Y/N',
          function () { s.tod = true; s.msg = '-TOD CLOCK- 12HR'; },
          function () { s.tod = false; s.msg = ''; });
        return true;
      case 'clockset': // CLK. UP/DN
        if (s.timeIn) { s.mode = null; s.msg = 'STOP CLOCK FIRST'; return true; }
        yesno(s, s.countDown ? 'COUNT UP? Y/N' : 'COUNT DOWN? Y/N',
          function () { s.countDown = !s.countDown; s.msg = s.countDown ? 'CLOCK COUNTS DN' : 'CLOCK COUNTS UP'; });
        return true;
      case 'period': // NEW GAME
        yesno(s, 'NEW GAME? Y/N', function () {
          var keepSwitch = s.timeIn, keepAuto = s.autoHorn;
          Object.assign(s, newGame(s.cfg, s.console));
          s.timeIn = keepSwitch; s.autoHorn = keepAuto;
          s.msg = 'NEW GAME';
        });
        return true;
      case 'minus1': // BLANK
        if (s.lastField) {
          s.blank[s.lastField] = !s.blank[s.lastField];
          s.msg = s.blank[s.lastField] ? 'DIGITS BLANKED' : 'DIGITS SHOWN';
        }
        s.mode = null;
        return true;
      case 'setint': // ON/OFF
        if (s.timeIn) { s.mode = null; s.msg = 'STOP CLOCK FIRST'; return true; }
        yesno(s, 'INT.TIMER ON?Y/N',
          function () { s.interval.on = true; s.interval.left = s.interval.len; s.msg = 'INTERVAL ON'; },
          function () { s.interval.on = false; s.msg = 'INTERVAL OFF'; });
        return true;
      case 'hpen': case 'vpen': { // penalty tracking
        var T = teamOf(key), hist = s[T].history;
        if (!hist.length) { s.mode = null; s.msg = 'NO PENALTIES'; return true; }
        if (m && m.kind === 'track' && m.team === T) m.idx = (m.idx + 1) % hist.length;
        else s.mode = { kind: 'track', team: T, idx: 0 };
        return true;
      }
    }
    return false; // no shifted job: behave like the plain key
  }

  function pressPlain(s, key) {
    var m = s.mode, T;
    if (DIGITS[key] !== undefined) return digit(s, DIGITS[key], key);
    if (PLUS[key] !== undefined) return plusKey(s, key);

    switch (key) {
      case 'hscore': case 'vscore':
        T = teamOf(key); s.mode = { kind: 'score', team: T, entry: '' }; s.lastField = T + 'score'; s.msg = ''; return;
      case 'hsog': case 'vsog':
        T = teamOf(key); s.mode = { kind: 'sog', team: T, entry: '' }; s.lastField = T + 'sog'; s.msg = ''; return;
      case 'period':
        s.mode = { kind: 'period', entry: '' }; s.lastField = 'period'; s.msg = ''; return;
      case 'hpen': case 'vpen':
        s.mode = { kind: 'pen', team: teamOf(key), adds: [], entry: '', lookup: false }; s.msg = ''; return;
      case 'htimeout': case 'vtimeout':
        T = teamOf(key);
        if (s.timeIn) { s.mode = null; s.msg = 'STOP CLOCK FIRST'; return; }
        s.mode = { kind: 'timeout', team: T }; s.msg = ''; return;
      case 'hgoal': case 'vgoal':
        T = teamOf(key);
        if (s[T].goalManual || s[T].goalMs > 0) { s[T].goalManual = false; s[T].goalMs = 0; }
        else s[T].goalManual = true;
        return;
      case 'autohorn':
        s.autoHorn = !s.autoHorn; s.mode = null; s.msg = s.autoHorn ? 'AUTO HORN ON' : 'AUTO HORN OFF'; return;
      case 'settimer':
        s.mode = null; s.msg = 'SHOT TIMER ONLY'; return;
      case 'bridim':
        s.mode = null; s.msg = 'INDOOR: NO DIM'; return;
      case 'setint':
        if (s.timeIn) { s.mode = null; s.msg = 'STOP CLOCK FIRST'; return; }
        s.mode = { kind: 'inttime', entry: '' }; return;
      case 'clockset':
        if (s.timeIn) { s.mode = null; s.msg = 'STOP CLOCK FIRST'; return; }
        if (m && m.kind === 'clockset') { m.which = (m.which + 1) % 3; m.entry = ''; }
        else s.mode = { kind: 'clockset', which: 0, entry: '' };
        return;
      case 'clr':
        if (!m) return;
        if (m.kind === 'pen') { m.adds = []; m.entry = ''; m.lookup = true; return; }
        if (m.entry !== undefined) m.entry = '';
        return;
      case 'enter':
        return enter(s);
    }
  }

  function digit(s, d, key) {
    var m = s.mode;
    if (!m) { s.coach = 'Pick what you are changing first, such as HOME SCORE or VISITOR PENALTY.'; return; }
    if (m.kind === 'yesno') {
      if (key === 'd4') s.coach = 'Hold SHIFT and press YES (the 4 key).';
      else if (key === 'd6') s.coach = 'Hold SHIFT and press NO (the 6 key).';
      else s.coach = 'The screen is asking a yes/no question. Use SHIFT + YES or SHIFT + NO.';
      return;
    }
    var max = MAXLEN[m.kind];
    if (!max) return;
    m.entry = (m.entry + d).slice(-max);
  }

  function plusKey(s, key) {
    var m = s.mode, n = PLUS[key];
    if (!m) { s.coach = 'Pick what you are changing first (SCORE, S.O.G., PERIOD or PENALTY).'; return; }
    if (m.kind === 'score' || m.kind === 'sog' || m.kind === 'period') {
      var v = FIELD[m.kind](s, m.team);
      setField(s, m.kind, m.team, v + n);
      m.entry = '';
      if (m.kind === 'score' && key === 'plus1') s[m.team].goalMs = 15 * SEC;
      return;
    }
    if (m.kind === 'pen') {
      if (key === 'minus1') { s.coach = 'For penalties use +1, +2 or +3. Your keypad has no OTHER key.'; return; }
      if (m.adds.length < 2) m.adds.push(s.cfg['pen' + n] * SEC);
      m.lookup = false;
      return;
    }
    if (m.kind === 'timeout' && key === 'minus1') {
      if (!s.timeout) {
        s.timeout = { team: m.team, left: s.cfg.timeoutLen * SEC, running: true };
        s[m.team].tol = Math.max(0, s[m.team].tol - 1);
      } else s.timeout.running = !s.timeout.running;
    }
  }

  function enter(s) {
    var m = s.mode;
    if (!m) return;
    var T = m.team;
    switch (m.kind) {
      case 'score': case 'sog': case 'period':
        if (m.entry !== '') setField(s, m.kind, T, parseInt(m.entry, 10));
        m.entry = '';
        return;
      case 'clockset': {
        var types = ['game', 'break', 'ot'];
        var defs = [s.cfg.periodLen, s.cfg.breakLen, s.cfg.otLen];
        var ms = m.entry !== '' ? entryMs(m.entry) : defs[m.which] * SEC;
        s.clock = ms;
        s.periodType = types[m.which];
        s.mode = null;
        s.msg = 'CLOCK SET ' + fmt(ms);
        if (s.periodType !== 'break' && anyActivePens(s)) {
          yesno(s, 'CORR.PENALTY?Y/N', function () {
            var list = activePens(s, 'H').map(function (p) { return { team: 'H', p: p }; })
              .concat(activePens(s, 'V').map(function (p) { return { team: 'V', p: p }; }));
            s.mode = { kind: 'corredit', list: list, idx: 0, entry: '' };
          }, function () { s.msg = 'PENALTIES KEPT'; });
        }
        return;
      }
      case 'pen': {
        if (m.entry === '') { s.mode = null; s.msg = 'NO PENALTY FOUND'; return; }
        if (m.adds.length) {
          var total = m.adds.reduce(function (a, b) { return a + b; }, 0);
          s.mode = null;
          if (!addPenalty(s, T, m.entry, total)) { s.msg = 'PENALTY MEM FULL'; return; }
          s.msg = T + '.# ' + m.entry + ' ' + fmt(total);
          return;
        }
        var p = findPen(s, T, m.entry);
        if (!p) { s.mode = null; s.msg = 'NO PENALTY FOUND'; return; }
        s.mode = { kind: 'penedit', team: T, player: p.player, entry: '' };
        return;
      }
      case 'penedit': {
        var pe = findPen(s, T, m.player);
        s.mode = null;
        if (!pe) { s.msg = 'NO PENALTY FOUND'; return; }
        if (m.entry !== '') { pe.left = entryMs(m.entry); pe.total = pe.left; s.msg = T + '.#' + pe.player + ' ' + fmt(pe.left); }
        else { s[T].pens.splice(s[T].pens.indexOf(pe), 1); s.msg = T + '.#' + pe.player + ' CLEARED'; }
        return;
      }
      case 'corredit': {
        var cur = m.list[m.idx];
        if (m.entry !== '') cur.p.left = entryMs(m.entry);
        m.idx++; m.entry = '';
        if (m.idx >= m.list.length) { s.mode = null; s.msg = 'PENALTIES FIXED'; }
        return;
      }
      case 'inttime':
        if (m.entry !== '') { s.interval.len = entryMs(m.entry); s.interval.left = s.interval.len; }
        s.mode = null; s.msg = 'INT. TIME ' + fmt(s.interval.len);
        return;
    }
  }

  function hornDown(s) { s.hornHeld = true; }
  function hornUp(s) { s.hornHeld = false; }

  /* ---------- time ---------- */

  function tick(s, dt) {
    if (s.hornMs > 0) s.hornMs = Math.max(0, s.hornMs - dt);
    if (s.msgMs > 0) { s.msgMs -= dt; if (s.msgMs <= 0) { s.msgMs = 0; s.msg = ''; } }
    if (s.timeIn) {
      var used = 0;
      if (s.countDown) {
        if (s.clock > 0) {
          used = Math.min(dt, s.clock);
          s.clock -= used;
          if (s.clock <= 0) { s.clock = 0; if (s.autoHorn) s.hornMs = 5 * SEC; }
        }
      } else { s.clock += dt; used = dt; }

      if (used > 0) {
        if (s.periodType !== 'break' && !s.penPaused) ['H', 'V'].forEach(function (T) {
          var team = s[T];
          activePens(s, T).forEach(function (p) { p.left -= used; });
          team.pens = team.pens.filter(function (p) { return p.left > 0; });
        });
        if (s.interval.on) {
          s.interval.left -= used;
          if (s.interval.left <= 0) { s.interval.left += s.interval.len; s.hornMs = Math.max(s.hornMs, 1500); }
        }
      }
    }
    ['H', 'V'].forEach(function (T) { if (s[T].goalMs > 0) s[T].goalMs = Math.max(0, s[T].goalMs - dt); });
    if (s.timeout && s.timeout.running) {
      s.timeout.left -= dt;
      if (s.timeout.left <= 0) { s.timeout = null; s.msg = 'TIMEOUT OVER'; }
    }
  }

  /* ---------- displays ---------- */

  function line(left, right) {
    right = right || '';
    var gap = Math.max(1, 16 - left.length - right.length);
    return (left + new Array(gap + 1).join(' ') + right).slice(0, 16);
  }
  function center(t) {
    var padL = Math.max(0, Math.floor((16 - t.length) / 2));
    return (new Array(padL + 1).join(' ') + t).slice(0, 16);
  }

  function fpLcd(s) {
    var code = s.periodType === 'break' ? 'BK' : s.periodType === 'ot' ? 'OT' : 'HK';
    var l1;
    if (s.tod) l1 = line('HK  TOD', clockStr(s));
    else {
      var ind = s.timeIn && (s.clock > 0 || !s.countDown) ? (s.countDown ? '▼' : '▲') : '■';
      l1 = line(code + (s.interval.on ? 'i' : ' ') + ' P' + s.period, clockStr(s) + ' ' + ind);
    }
    return [l1, lcdLine2(s)];
  }

  function lcdLine2(s) {
    var m = s.mode;
    if (!m) {
      if (s.timeout) return line(s.timeout.team + '.TIMEOUT', String(Math.ceil(s.timeout.left / SEC)));
      return s.msg ? line(s.msg) : center('- HOCKEY -');
    }
    var T = m.team;
    switch (m.kind) {
      case 'score': return line(T + '.SCORE', m.entry || String(s[T].score));
      case 'sog': return line(T + '.S.O.GOAL', m.entry || String(s[T].sog));
      case 'period': return line('PERIOD', m.entry || String(s.period));
      case 'clockset': {
        var defs = [s.cfg.periodLen, s.cfg.breakLen, s.cfg.otLen];
        return line(['SET CLK.', 'SET BRK.', 'SET O.T.'][m.which], m.entry ? fmtEntry(m.entry) : fmt(defs[m.which] * SEC));
      }
      case 'pen':
        if (m.adds.length) return line('ENTER PLY.NO.', m.entry);
        return line(m.lookup ? 'PLAYER NO.?' : T + '.PENALTY', m.entry);
      case 'penedit': {
        var p = findPen(s, T, m.player);
        return line(T + '.#' + m.player, m.entry ? fmtEntry(m.entry) : p ? fmt(p.left) : '');
      }
      case 'corredit': {
        var c = m.list[m.idx];
        return line(c.team + '.#' + c.p.player + ' PEN?', m.entry ? fmtEntry(m.entry) : fmt(c.p.left));
      }
      case 'track': {
        var h = s[T].history[m.idx];
        return line(T + '#' + h.player, fmt(h.total));
      }
      case 'timeout':
        if (s.timeout && s.timeout.team === T) return line(T + '.TIMEOUT', String(Math.ceil(s.timeout.left / SEC)));
        return line('(' + s.cfg.timeoutLen + ')' + T + '.T.O.', String(s[T].tol));
      case 'yesno': return line(m.q);
      case 'inttime': return line('INT. TIME?', m.entry ? fmtEntry(m.entry) : fmt(s.interval.len));
    }
    return line('');
  }

  function board(s) {
    function team(T) {
      return {
        score: s[T].score, sog: s[T].sog,
        goal: s[T].goalManual || s[T].goalMs > 0,
        pens: activePens(s, T).map(function (p) { return { player: p.player, time: fmt(p.left) }; }),
        waiting: Math.max(0, s[T].pens.length - 2)
      };
    }
    return {
      H: team('H'), V: team('V'), clock: clockStr(s), period: s.period, tod: s.tod,
      horn: s.hornMs > 0 || s.hornHeld, blank: s.blank, periodType: s.periodType
    };
  }

  /* ---------- console registry ---------- */

  var consoles = { fairplay: { press: fpPress, lcd: fpLcd } };
  function press(s, key) { return consoles[s.console || 'fairplay'].press(s, key); }
  function lcd(s) { return consoles[s.console || 'fairplay'].lcd(s); }

  var api = {
    SEC: SEC, defaultSettings: defaultSettings, newGame: newGame, press: press, tick: tick,
    setTimeIn: setTimeIn, hornDown: hornDown, hornUp: hornUp, lcd: lcd, board: board,
    fmt: fmt, entryMs: entryMs, addPenalty: addPenalty, findPen: findPen, activePens: activePens, other: other,
    consoles: consoles, yesno: yesno, line: line, center: center, pad2: pad2, clockStr: clockStr
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
