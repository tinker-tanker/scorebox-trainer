/* Nevco MPC control, hockey overlay (model code 871).
   Behaviour follows the Nevco "Scoreboard Operator's Instructions, MPC Control, Hockey"
   (135-0066, 1/21/2011). Display wording follows the manual where it gives it; other
   screens are close approximations. Registers itself in Engine.consoles.nevco and reuses
   the shared game core (clock, penalty clocks, scoreboard) from engine.js. */
(function (root) {
  'use strict';

  var E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.Engine;
  var SEC = E.SEC;

  var DIGITS = { d0: '0', d1: '1', d2: '2', d3: '3', d4: '4', d5: '5', d6: '6', d7: '7', d8: '8', d9: '9' };
  var TEAM = { hscore: 'H', vscore: 'V', hsog: 'H', vsog: 'V', hpen: 'H', vpen: 'V', hgoal: 'H', vgoal: 'V' };
  function tl(T) { return T === 'H' ? 'H' : 'G'; }            // the console says GUEST
  function teamWord(T) { return T === 'H' ? 'HOME' : 'GUEST'; }

  function pad(n, w) { n = String(n); while (n.length < w) n = ' ' + n; return n; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  // M:SS.t, the way the control shows the main time ("8:00.0 DN")
  function fmtT(ms) {
    var t = Math.floor(Math.max(0, ms) / 100);
    var s = Math.floor(t / 10);
    return Math.floor(s / 60) + ':' + p2(s % 60) + '.' + (t % 10);
  }

  // Digits fill a prompt's mask left to right: "SET MM:SS.s" after 0, 8 shows "SET 08:SS.s".
  function fill(mask, digits) {
    var i = 0;
    return mask.replace(/[MSs_]/g, function (ch) { return i < digits.length ? digits.charAt(i++) : ch; });
  }
  // Unfilled places count as zero ("letters that have not been replaced ... will be replaced with zeros")
  function timeMs(digits, withTenths) {
    var d = (digits + '00000').slice(0, withTenths ? 5 : 4);
    var ms = (parseInt(d.slice(0, 2), 10) * 60 + parseInt(d.slice(2, 4), 10)) * SEC;
    if (withTenths) ms += parseInt(d.charAt(4), 10) * 100;
    return ms;
  }

  function error(s, coach) {
    s.mode = null;
    s.msg = 'ENTRY ERROR';
    s.msgMs = 2000;
    if (coach) s.coach = coach;
  }
  function say(s, text, ms) { s.msg = text; s.msgMs = ms || 0; }

  /* ---------- power and startup ---------- */

  function power(s) {
    if (s.power) { s.power = false; s.boot = null; s.mode = null; s.set = false; s.msg = ''; return; }
    s.power = true;
    s.set = false;
    s.mode = null;
    s.msg = '';
    s.boot = { stage: 'resume', entry: '' };
  }

  function bootKey(s, key) {
    var b = s.boot;
    if (b.stage === 'resume') {
      if (key === 'yes') { s.boot = null; say(s, ''); }
      else if (key === 'no') b.stage = 'bookmark';
      return;
    }
    if (b.stage === 'bookmark') {
      if (key === 'yes') error(s, 'No bookmarks are saved on this trainer. Answer NO, then enter the model code.');
      else if (key === 'no') { b.stage = 'model'; b.entry = ''; }
      return;
    }
    if (b.stage === 'model') {
      if (DIGITS[key] !== undefined) {
        b.entry += DIGITS[key];
        if (b.entry.length === 3) {
          if (b.entry === '871') { b.stage = 'pto'; say(s, 'HOCKEY', 1500); }
          else { b.entry = ''; error(s, 'The hockey overlay\'s model code is 871. It is printed near the top of the overlay.'); }
        }
      } else if (key === 'no' && b.entry) b.entry = b.entry.slice(0, -1);
      return;
    }
    if (b.stage === 'pto') {
      if (key !== 'yes' && key !== 'no') return;
      var keepSwitch = s.timeIn, keepAuto = s.autoHorn;
      Object.assign(s, E.newGame(s.cfg, 'nevco'));
      s.clock = 0;                                  // a fresh start shows 0:00.0 DN
      s.timeIn = keepSwitch;
      s.autoHorn = keepAuto;
      s.penTimeoutEnabled = key === 'yes';
      s.boot = null;
      say(s, '');
    }
  }

  /* ---------- key handling ---------- */

  function press(s, key) {
    s.coach = '';
    if (key === 'power') return power(s);
    if (!s.power) return;
    if (s.boot) return bootKey(s, key);
    if (key === 'horn' && !s.set) return;           // a plain press is hold-to-sound, handled by the page
    if (s.msg === 'ENTRY ERROR') { s.msg = ''; s.msgMs = 0; }

    var setArmed = s.set;
    if (key === 'set') { s.set = !setArmed; s.mode = null; say(s, ''); return; }
    s.set = false;

    if (s.mode && modeKey(s, s.mode, key)) return;
    if (setArmed) return setKey(s, key);
    plainKey(s, key);
  }

  // Returns true when the active prompt used the key.
  function modeKey(s, m, key) {
    var d = DIGITS[key];
    switch (m.kind) {
      case 'add': {
        if (d !== undefined) {
          var max = m.field === 'score' ? 199 : 99;
          s[m.team][m.field] = Math.min(max, s[m.team][m.field] + parseInt(d, 10));
          return true;
        }
        if (key === 'yes' || key === 'no') { s.mode = null; return true; }
        s.mode = null;
        return false;                                // another function key: leave add mode, then act
      }
      case 'entry': {
        if (d !== undefined || (key === 'blank' && m.blank)) {
          if (m.digits.length < m.slots) m.digits += d !== undefined ? d : ' ';
          return true;
        }
        if (key === 'yes') { var done = m.done; s.mode = null; done(m.digits); return true; }
        if (key === 'no') {
          if (m.digits.length) m.digits = m.digits.slice(0, -1);
          else { var cancel = m.cancel; s.mode = null; if (cancel) cancel(); }
          return true;
        }
        if (key === 'blank') return true;
        s.mode = null;
        return false;
      }
      case 'period': {
        if (d !== undefined) { s.period = Math.max(0, parseInt(d, 10)); s.mode = null; return true; }
        if (key === 'yes' || key === 'no') { s.mode = null; return true; }
        s.mode = null;
        return false;
      }
      case 'confirm': {
        if (key === 'yes') { var y = m.yes; s.mode = null; y(); return true; }
        if (key === 'no') { var no = m.no; s.mode = null; if (no) no(); return true; }
        s.mode = null;
        return false;
      }
      case 'recall': {
        var list = s[m.team].pens, cur = list[m.idx];
        if ((key === 'hpen' || key === 'vpen') && TEAM[key] === m.team) {
          m.idx = list.length ? (m.idx + 1) % list.length : 0;
          return true;
        }
        if (key === 'pclear' && cur) {
          s.mode = { kind: 'confirm', q: 'CLEAR (Y-N)', yes: function () {
            var i = s[m.team].pens.indexOf(cur);
            if (i >= 0) s[m.team].pens.splice(i, 1);
            say(s, tl(m.team) + ' PEN. CLEARED', 2000);
          } };
          return true;
        }
        if (key === 'pedit' && cur) {
          s.mode = { kind: 'confirm', q: 'EDIT (Y-N)', yes: function () {
            s.mode = { kind: 'entry', label: 'PEN ', mask: 'MM:SS', slots: 4, digits: '', done: function (dg) {
              cur.left = timeMs(dg, false); cur.total = cur.left;
              say(s, tl(m.team) + ' ' + E.fmt(cur.left) + ' #' + cur.player, 2500);
            } };
          } };
          return true;
        }
        if (key === 'pins') {
          var at = cur ? m.idx : list.length;
          s.mode = { kind: 'confirm', q: 'INSERT (Y-N)', yes: function () { newPenalty(s, m.team, at); } };
          return true;
        }
        if (key === 'yes' || key === 'no') { s.mode = null; return true; }
        s.mode = null;
        return false;
      }
      case 'timer': {
        if (d !== undefined) {
          s.mode = null;
          s.timeout = { team: null, left: (d === '0' ? 30 : 60) * SEC, running: true, warn: d === '0' ? 10 * SEC : 0 };
          return true;
        }
        s.mode = null;
        return key === 'no' || key === 'yes';
      }
    }
    return false;
  }

  // SET, then a penalty key: time, YES, player number, YES.
  function newPenalty(s, T, insertAt) {
    s.mode = { kind: 'entry', label: 'PEN ', mask: 'MM:SS', slots: 4, digits: '', done: function (dg) {
      var ms = timeMs(dg, false);
      if (!ms) return error(s, 'Type the penalty time first, for example 0 1 3 0 for 1:30, then YES.');
      s.mode = { kind: 'entry', label: tl(T) + '.PLAYER # ', mask: '__', slots: 2, blank: true, digits: '', done: function (pd) {
        var player = pd.replace(/\s/g, '');
        if (!player) return error(s, 'Type the player number, then press YES.');
        if (!E.addPenalty(s, T, player, ms)) return error(s, 'The console holds up to five penalties per team.');
        var list = s[T].pens, p = list.pop();
        list.splice(insertAt == null ? list.length : Math.min(insertAt, list.length), 0, p);
        say(s, tl(T) + ' ' + E.fmt(ms) + ' #' + player, 2500);
      } };
    } };
  }

  function setKey(s, key) {
    var T = TEAM[key];
    switch (key) {
      case 'time':
        s.todControl = false;
        s.mode = { kind: 'entry', label: 'SET ', mask: 'MM:SS.s', slots: 5, digits: '',
          done: function (dg) { s.clock = timeMs(dg, true); s.periodType = 'game'; s.mode = { kind: 'period' }; },
          cancel: function () { s.mode = { kind: 'period' }; } };      // SET TIME NO: keep the time, fix the period
        return;
      case 'hscore': case 'vscore':
        s.mode = { kind: 'entry', label: 'SET ' + teamWord(T) + ' ', mask: '___', slots: 3, digits: '',
          done: function (dg) { if (dg) s[T].score = Math.min(199, parseInt(dg, 10)); } };
        return;
      case 'hsog': case 'vsog':
        s.mode = { kind: 'entry', label: 'SET ' + tl(T) + '.SHOTS ', mask: '__', slots: 2, digits: '',
          done: function (dg) { if (dg) s[T].sog = Math.min(99, parseInt(dg, 10)); } };
        return;
      case 'hpen': case 'vpen':
        return newPenalty(s, T, null);
      case 'horn':
        s.mode = { kind: 'confirm', q: 'AUTO HORN ? (Y/N)', yes: function () { s.autoHorn = true; } };
        s.mode.no = function () { s.autoHorn = false; };
        return;
    }
    error(s, key === 'chrono' || key === 'options' || key === 'totstart'
      ? 'That setup menu is not part of this trainer. Press NO, or another key, to carry on.'
      : 'SET only goes in front of TIME, a SCORE, SHOTS or PENALTY key, or HORN.');
  }

  function plainKey(s, key) {
    var T = TEAM[key];
    if (DIGITS[key] !== undefined) return error(s, 'Pick what you are changing first, such as HOME SCORE, or SET and then a key.');
    switch (key) {
      case 'hscore': case 'vscore':
        s.mode = { kind: 'add', field: 'score', team: T }; return;
      case 'hsog': case 'vsog':
        s.mode = { kind: 'add', field: 'sog', team: T }; return;
      case 'hgoal': case 'vgoal':
        if (s[T].goalManual || s[T].goalMs > 0) { s[T].goalManual = false; s[T].goalMs = 0; }
        else s[T].goalManual = true;
        say(s, tl(T) + '.GOAL  ' + (s[T].goalManual ? 'ON' : 'OFF'), 2000);
        return;
      case 'hpen': case 'vpen':
        if (!s[T].pens.length) { s.mode = { kind: 'recall', team: T, idx: 0 }; return; }
        s.mode = { kind: 'recall', team: T, idx: 0 }; return;
      case 'pins': case 'pedit': case 'pclear':
        return error(s, 'First press HOME PENALTY or GUEST PENALTY to show a penalty, then this key.');
      case 'ponoff':
        if (!s.penTimeoutEnabled) return error(s, 'PENALTY ON/OFF only works if you answered YES to "use penalty time out" when the control started.');
        s.penPaused = !s.penPaused;
        say(s, s.penPaused ? 'PENALTY TIME OFF' : 'PENALTY TIME ON', 2500);
        return;
      case 'time':
        s.todControl = false; s.mode = null; say(s, ''); return;
      case 'timeon': case 'timeoff':
        return error(s, 'The hand-held switch is plugged in, so these keys are off. Use the switch on the cord.');
      case 'totstart':
        s.mode = { kind: 'timer' }; return;
      case 'totclear':
        if (!s.timeout) return error(s, 'No time out timer is running.');
        s.timeout.left = Math.min(s.timeout.left, s.timeout.warn || 0);
        if (!s.timeout.left) s.timeout = null;
        s.hornMs = Math.max(s.hornMs, 1000);
        return;
      case 'chrono':
        s.todControl = true; s.mode = null; return;
      case 'options':
        say(s, 'AUTO HORN ' + (s.autoHorn ? 'ON' : 'OFF') + '   PENALTY TIME OUT ' + (s.penTimeoutEnabled ? 'ON' : 'OFF') + '   .1 SEC SHIFT ' + (s.cfg.tenths ? 'ON' : 'OFF'), 9000);
        return;
      case 'shottime':
        return error(s, 'There is no shot clock in hockey, so this key is not used.');
      case 'blank':
        return error(s, 'BLANK is only used while typing a number, such as a player number.');
      case 'yes': case 'no':
        s.mode = null; return;
    }
  }

  /* ---------- display: one 16-character LED line ---------- */

  function center(t) { return E.center(t); }

  function lcd(s) {
    if (!s.power) return [''];
    var b = s.boot;
    if (b) {
      if (s.msg && s.msgMs > 0) return [center(s.msg)];
      if (b.stage === 'resume') return ['START WHERE TURNED OFF LAST?'];
      if (b.stage === 'bookmark') return ['GO TO A BOOKMARK?'];
      if (b.stage === 'model') return [b.entry ? center('MODEL CODE ' + fill('___', b.entry)) : 'ENTER YOUR MODEL CODE'];
      if (b.stage === 'pto') return ['DO YOU WANT TO USE PENALTY TIME OUT?'];
    }
    var m = s.mode;
    if (m) {
      switch (m.kind) {
        case 'add': return [E.line(m.field === 'score' ? teamWord(m.team) : tl(m.team) + '.SHOTS', s[m.team][m.field] + '+')];
        case 'entry': return [E.line(m.label + fill(m.mask, m.digits))];
        case 'period': return [E.line('PERIOD', String(s.period))];
        case 'confirm': return [m.q.length > 16 ? m.q : E.line(m.q)];   // longer prompts scroll
        case 'timer': return [center('TIMER # (0-9)?')];
        case 'recall': {
          var p = s[m.team].pens[m.idx];
          if (!p) return [center(tl(m.team) + ' NO PENALTIES')];
          return [E.line(tl(m.team) + ' ' + (m.idx + 1) + ' ' + E.fmt(p.left), pad(p.player, 2))];
        }
      }
    }
    if (s.msg) return [s.msg.length > 16 ? s.msg : center(s.msg)];
    if (s.timeout) return [E.line('TIME OUT', String(Math.ceil(s.timeout.left / SEC)))];
    if (s.todControl) {
      var d = new Date(), h = d.getHours() % 12 || 12;
      return [center(h + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + (d.getHours() < 12 ? ' AM' : ' PM'))];
    }
    return [E.line(' ' + fmtT(s.clock), (s.countDown ? 'DN' : 'UP') + ' ')];
  }

  E.consoles.nevco = { press: press, lcd: lcd, timeMs: timeMs, fmtT: fmtT };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.consoles.nevco;
})(this);
