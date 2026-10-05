/* Nevco MPC control with the hockey overlay (model code 871): keypad layout, hand-held time
   switch, key explanations, lessons, task recipes and cheat sheet. The key behaviour itself
   lives in nevco-engine.js. Layout follows the overlay drawing in the operator's instructions. */
(function (root) {
  'use strict';

  function make(ctx) {
    var E = ctx.E, SEC = E.SEC, cfg = ctx.cfg, fmt = ctx.fmt;
    var midGame = ctx.midGame, inMode = ctx.inMode, hasPen = ctx.hasPen, numKeys = ctx.numKeys;

    function minorStr() { return fmt(cfg.minor); }
    // The MPC fills MM:SS from the left: 1:30 is 0 1 3 0, 15:00 is 1 5 (the rest fill with zeros)
    function mmss(sec) {
      var m = Math.floor(sec / 60), s = sec % 60;
      return (m < 10 ? '0' : '') + m + (s < 10 ? '0' : '') + s;
    }
    function mmssKeys(sec) { return mmss(sec).split('').map(function (d) { return 'd' + d; }); }
    // shortest form for a clock time: trailing zeros can be left off
    function clockKeys(sec) { return mmssKeys(sec).join(',').replace(/(,d0)+$/, '').split(','); }
    function spaced(keys) { return keys.map(function (k) { return k.slice(1); }).join(' '); }

    var KL = {
      horn: ['Horn'], shottime: ['Misc. Shot Time'], set: ['Set'], pins: ['Penalty Insert'], pedit: ['Penalty Edit'], time: ['Time'],
      ponoff: ['Penalty On Off'], pclear: ['Penalty Clear'], timeon: ['Time On'], timeoff: ['Time Off'],
      hgoal: ['Home Goal'], vgoal: ['Guest Goal'], hpen: ['Home Penalty'], vpen: ['Guest Penalty'], hsog: ['Home Shots'], vsog: ['Guest Shots'],
      totstart: ['T.O. Timer Start'], totclear: ['T.O. Timer Clear'], options: ['Options'], yes: ['Yes'], no: ['No'],
      chrono: ['Chronometer'], hscore: ['Home Score'], vscore: ['Guest Score'], blank: ['Blank'],
      timein: ['Hand switch', 'switch'], power: ['Power', 'switch']
    };
    function keyLabel(k) {
      if (/^d\d$/.test(k)) return [k.slice(1), 'nv'];
      var l = KL[k] || [k];
      return [l[0], l[1] || 'nv'];
    }

    var INFO = {
      timein: ['Hand-held time switch', 'The rocker on the hand-held switch starts and stops the game clock: on when the puck drops, off at every whistle. Penalty clocks follow it. While it is plugged in, the TIME ON and TIME OFF keys do nothing.'],
      horn: ['HORN', 'Sounds the horn while you hold it (the button on the hand switch does the same). SET then HORN asks whether the automatic end-of-period horn is on. Leave it on.'],
      set: ['SET', 'Press SET first to type an exact value: SET then TIME sets the clock, SET then a SCORE or SHOTS key types the number, SET then a PENALTY key enters a new penalty. Its light shows it is waiting.'],
      time: ['TIME', 'Brings the game clock back to the display. SET then TIME sets the clock: type the minutes and seconds from the left (1 5 for 15:00), YES, then press the period number.'],
      hscore: ['HOME SCORE', 'Adds to the home score: press it, then 1 for one goal. It cannot subtract. To fix a score, press SET, HOME SCORE, type the right number, YES.'],
      vscore: ['GUEST SCORE', 'Same as HOME SCORE, for the visiting team.'],
      hsog: ['HOME SHOTS', 'Adds shots on goal: press it, then 1. SET then HOME SHOTS types the exact number.'],
      vsog: ['GUEST SHOTS', 'Same as HOME SHOTS, for the visiting team.'],
      hpen: ['HOME PENALTY', 'SET then HOME PENALTY enters a penalty: type the time (0 1 3 0 for 1:30), YES, the player number, YES. Without SET it shows the home penalties one at a time; press again for the next one.'],
      vpen: ['GUEST PENALTY', 'Same as HOME PENALTY, for the visiting team.'],
      pclear: ['PENALTY CLEAR', 'Clears the penalty that is showing on the display. First press a PENALTY key until the right player shows, then PENALTY CLEAR, then YES. Use it after a power-play goal.'],
      pedit: ['PENALTY EDIT', 'Changes the time left on the penalty that is showing: PENALTY EDIT, YES, the new time, YES.'],
      pins: ['PENALTY INSERT', 'Adds a penalty ahead of the one that is showing. You will rarely need it; SET then PENALTY adds one at the end.'],
      ponoff: ['PENALTY ON OFF', 'Stops or restarts the penalty clocks while the game clock runs. It only works if you answered YES to "use penalty time out" when the control started. Most games never use it.'],
      hgoal: ['HOME GOAL', 'Only switches the goal light on or off. It does NOT add a goal. Use HOME SCORE then 1 for goals.'],
      vgoal: ['GUEST GOAL', 'Only switches the guest goal light. It does NOT add a goal.'],
      timeon: ['TIME ON', 'Starts the clock, but only when the hand-held switch is unplugged. With the switch plugged in, use the switch.'],
      timeoff: ['TIME OFF', 'Stops the clock, but only when the hand-held switch is unplugged.'],
      totstart: ['TIME OUT TIMER START', 'Starts a timeout countdown: press it, then 0 for the standard 30-second timer. Turning the game clock on cancels it.'],
      totclear: ['TIME OUT TIMER CLEAR', 'Cuts a running timeout timer short.'],
      options: ['OPTIONS', 'Scrolls a report of the current settings across the display. SET then OPTIONS changes them; leave that to the rink.'],
      chrono: ['CHRONOMETER', 'Shows the time of day on the display. Press TIME to bring the game clock back.'],
      shottime: ['MISC. SHOT TIME', 'For shot clocks. Not used in hockey.'],
      yes: ['YES', 'Answers yes and saves what you typed.'],
      no: ['NO', 'Answers no. While typing, it erases the last digit; press it again to cancel.'],
      blank: ['BLANK', 'Types a blank digit while you enter a number, such as a one-digit player number. You can usually skip it.'],
      power: ['POWER', 'Turns the control on and off. It does not turn off the scoreboard. When it comes on it asks "Start where turned off last?": YES carries on, NO starts fresh with the model code.']
    };

    /* ---------- the console ---------- */
    var LEFT = [
      ['horn', 'Horn'], ['shottime', 'Misc.<br>Shot<br>Time'], [null], ['set', 'Set'],
      [null], ['pins', 'Penalty<br>Insert'], ['pedit', 'Penalty<br>Edit'], ['time', 'Time'],
      ['ponoff', 'Penalty<br>On<br>Off'], ['pclear', 'Penalty<br>Clear'], [null], [null],
      ['timeon', 'Time<br>On'], ['hgoal', 'Home<br>Goal'], ['hpen', 'Home<br>Penalty'], ['hsog', 'Home<br>Shots'],
      ['timeoff', 'Time<br>Off'], ['vgoal', 'Guest<br>Goal'], ['vpen', 'Guest<br>Penalty'], ['vsog', 'Guest<br>Shots']
    ];
    var RIGHT = [
      ['totstart', '<small>Time Out Timer</small>Start'], ['totclear', '<small>Time Out Timer</small>Clear'], ['options', 'Options'], ['yes', 'Yes', 'big'],
      ['d7', '7', 'num'], ['d8', '8', 'num'], ['d9', '9', 'num'], ['no', 'No', 'big'],
      ['d4', '4', 'num'], ['d5', '5', 'num'], ['d6', '6', 'num'], ['chrono', 'Chrono&shy;meter<br><small>(Time of Day)</small>'],
      ['d1', '1', 'num'], ['d2', '2', 'num'], ['d3', '3', 'num'], ['hscore', 'Home<br>Score'],
      [null], ['blank', 'Blank'], ['d0', '0', 'num'], ['vscore', 'Guest<br>Score']
    ];
    function cell(k) {
      if (!k[0]) return '<span class="nvk nvk-empty" aria-hidden="true"><span class="nvk-label"></span><span class="nvk-pad"></span></span>';
      return '<button type="button" class="nvk ' + (k[2] ? 'nvk-' + k[2] : '') + '" data-key="' + k[0] + '" aria-label="' + keyLabel(k[0])[0] + '">' +
        '<span class="nvk-label">' + k[1] + '</span><span class="nvk-pad"></span></button>';
    }
    function html() {
      return '<div class="nv">' +
        '<div class="nv-unit">' +
          '<div class="nv-head"><span class="nv-logo">NEVCO</span>' +
            '<div class="nv-window"><div class="nv-led" id="lcd" role="status" aria-label="Control display"></div></div>' +
            '<button type="button" class="nv-power" data-key="power" aria-label="Power switch" aria-pressed="true"><i></i><span>POWER</span></button></div>' +
          '<div class="nv-overlay"><div class="nv-code">Model Code 871<br>Hockey</div>' +
            '<div class="nv-pads"><div class="nv-pad">' + LEFT.map(cell).join('') + '</div>' +
            '<div class="nv-pad">' + RIGHT.map(cell).join('') + '</div></div></div>' +
        '</div>' +
        '<div class="nv-hand"><span class="lbl">Hand switch</span>' +
          '<div class="nv-handbody"><span class="nv-handled" id="handled"></span>' +
          '<button type="button" class="rocker nv-rocker" data-key="timein" aria-label="Time switch" aria-pressed="false"><i></i></button>' +
          '<button type="button" class="nv-hornbtn" data-key="horn" aria-label="Horn button"></button>' +
          '<span class="nv-handtag">TIME &middot; HORN</span></div>' +
          '<span class="rstate" id="rstate">Clock stopped</span></div>' +
        '</div>';
    }
    function mounted() {}
    function update(s, root) {
      root.querySelector('.nv').classList.toggle('off', !s.power);
      var pw = root.querySelector('[data-key="power"]');
      pw.classList.toggle('on', !!s.power); pw.setAttribute('aria-pressed', String(!!s.power));
      root.querySelector('[data-key="set"]').classList.toggle('lit', !!s.set && s.power);
      root.querySelector('[data-key="ponoff"]').classList.toggle('lit', !!s.penPaused && s.power);
      root.querySelector('#handled').classList.toggle('on', !!s.timeIn && s.power);
      ctx.updateSwitch(s, root);
    }

    /* ---------- task recipes (drills, cheat sheet) ---------- */
    function recall(T, p, s) {
      var list = s ? s[T].pens : [], i = 0;
      for (var j = 0; j < list.length; j++) if (list[j].player === String(p)) { i = j; break; }
      var keys = [];
      for (var n = 0; n <= i; n++) keys.push(T.toLowerCase() + 'pen');
      return keys;
    }
    var R = {
      goal: function (T) { var t = T.toLowerCase(); return [t + 'score', 'd1', t + 'sog', 'd1']; },
      shot: function (T) { return [T.toLowerCase() + 'sog', 'd1']; },
      penalty: function (T, p, ms) { return ['set', T.toLowerCase() + 'pen'].concat(mmssKeys(ms / SEC), ['yes'], numKeys(p), ['yes']); },
      clearPenalty: function (T, p, s) { return recall(T, p, s).concat(['pclear', 'yes']); },
      setPenaltyTime: function (T, p, ms, s) { return recall(T, p, s).concat(['pedit', 'yes'], mmssKeys(ms / SEC), ['yes']); },
      scoreDown: function (T, s) { return ['set', T.toLowerCase() + 'score'].concat(numKeys(Math.max(0, (s ? s[T].score : 1) - 1)), ['yes']); },
      shotUp: function (T) { return [T.toLowerCase() + 'sog', 'd1']; },
      periodDown: function (s) { return ['set', 'time', 'no', 'd' + Math.max(1, (s ? s.period : 2) - 1)]; },
      fixClock: function (sec) { return ['set', 'time'].concat(mmssKeys(sec), ['yes', 'no']); },
      nextPeriod: function (s) { return ['set', 'time'].concat(clockKeys(cfg.periodLen), ['yes', 'd' + ((s ? s.period : 1) + 1)]); }
    };

    /* ---------- lessons ---------- */
    function minorKeys() { return mmssKeys(cfg.minor); }
    var LESSONS = [
      {
        id: 'meet', title: 'Meet the control', sub: 'Two keypads, a red display and a hand switch',
        intro: function () { return 'This is the Nevco control in the scorekeeper\'s box. The left keypad runs the game, the right one has the numbers. The hand-held switch on the cord runs the clock.'; },
        setup: function (s) { midGame(s, { clock: cfg.periodLen }); },
        steps: [
          { t: 'Find the <b>hand switch</b> on the cord. Its rocker starts and stops the game clock. Flip it on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
          { t: 'The clock is counting down on the scoreboard and on the red display. Flip the switch off to stop it.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: 'Press <b>HOME SCORE</b>. The display shows HOME, the score and a "+": the control is ready to add.', keys: ['hscore'], check: function (s) { return inMode(s, 'add') && s.mode.team === 'H' && s.mode.field === 'score'; } },
          { t: 'Press <b>GUEST SHOTS</b>. On this control the visiting team is GUEST.', keys: ['vsog'], check: function (s) { return inMode(s, 'add') && s.mode.team === 'V' && s.mode.field === 'sog'; } },
          { t: '<b>SET</b> is the key you will use most. It means "I want to type an exact value". Press SET: its light comes on.', keys: ['set'], check: function (s) { return !!s.set; } },
          { t: 'Press <b>SET</b> again to cancel. The display goes back to the clock.', keys: ['set'], check: function (s) { return !s.set && !s.mode; } }
        ],
        wrap: 'You know the layout. Next is running the clock, which is most of the job.'
      },
      {
        id: 'clock', title: 'Start and stop the clock', sub: 'The skill that matters most',
        intro: function () { return 'The clock runs only while the puck is in play. Keep your eyes on the referee and the hand switch in your hand.'; },
        setup: function (s) { midGame(s, { clock: cfg.periodLen, hs: 0, vs: 0 }); },
        steps: [
          { t: 'The referee drops the puck for the opening faceoff. Flip the <b>hand switch</b> on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
          { t: 'Whistle! The puck flew over the glass. Switch off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: 'Faceoff. Clock on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
          { t: 'Whistle for offside. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: 'Start the clock when the puck leaves the referee\'s hand, not when the players line up. Clock on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
          { t: 'Whistle. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } }
        ],
        wrap: 'Each second you are late is a second added to or taken from the game. The TIME ON and TIME OFF keys do nothing while the hand switch is plugged in. On a computer, the space bar flips the switch.'
      },
      {
        id: 'setclock', title: 'Set the period clock', sub: 'SET, TIME, minutes, YES, period',
        intro: function () { return 'Before each period you set the clock to ' + fmt(cfg.periodLen) + '. On this control you type the time from the left, minutes first.'; },
        setup: function (s) { s.clock = 0; },
        steps: [
          { t: 'Press <b>SET</b>, then <b>TIME</b>. The display shows SET MM:SS.s.', keys: ['set', 'time'], check: function (s) { return inMode(s, 'entry') && s.mode.mask === 'MM:SS.s'; } },
          { t: function () { return 'Type the minutes: <b>' + spaced(clockKeys(cfg.periodLen)) + '</b>. The letters you do not replace become zeros.'; }, keys: function () { return clockKeys(cfg.periodLen); }, check: function (s) { return inMode(s, 'entry') && s.mode.mask === 'MM:SS.s' && E.consoles.nevco.timeMs(s.mode.digits, true) === cfg.periodLen * SEC; } },
          { t: 'Press <b>YES</b>. The display now asks for the PERIOD.', keys: ['yes'], check: function (s) { return inMode(s, 'period') && s.clock === cfg.periodLen * SEC; } },
          { t: 'Press <b>1</b> for the first period.', keys: ['d1'], check: function (s) { return !s.mode && s.period === 1 && s.clock === cfg.periodLen * SEC; } }
        ],
        wrap: 'Typed a wrong digit? Press NO to back up one digit, then type it again. If only the period is wrong, press SET, TIME, NO and then the right period number.'
      },
      {
        id: 'goal', title: 'Record a goal', sub: 'And the key that looks like it but isn\'t',
        intro: function () { return 'When a goal is scored, the referee blows the whistle and points at the net.'; },
        setup: function (s) { midGame(s, { running: true }); },
        steps: [
          { t: 'Whistle. Home scored! Stop the clock first.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: 'Press <b>HOME SCORE</b>, then <b>1</b>. The number you press is added to the score.', keys: ['hscore', 'd1'], check: function (s, p) { return s.H.score === p.H.score + 1; } },
          { t: 'A goal also counts as a shot on goal. Press <b>HOME SHOTS</b>, then <b>1</b>.', keys: ['hsog', 'd1'], check: function (s, p) { return s.H.sog === p.H.sog + 1; } },
          { t: 'Later, the guests score. Press <b>GUEST SCORE</b>, then <b>1</b>.', keys: ['vscore', 'd1'], check: function (s, p) { return s.V.score === p.V.score + 1; } },
          { t: 'Now a trap. Press <b>HOME GOAL</b>. The display says H.GOAL ON and the red light turns on, but the score does not change.', keys: ['hgoal'], start: function (s) { s.H.goalMs = 0; s.V.goalMs = 0; }, check: function (s) { return s.H.goalManual; } },
          { t: 'Press <b>HOME GOAL</b> again to turn the light off. For goals, always use HOME SCORE.', keys: ['hgoal'], check: function (s) { return !s.H.goalManual && s.H.goalMs === 0; } }
        ],
        wrap: 'Goal = clock off, SCORE then 1, SHOTS then 1. Pressed 2 by mistake? The next lesson shows the fix.'
      },
      {
        id: 'fixscore', title: 'Fix a wrong number', sub: 'The score keys only add',
        intro: function () { return 'The score and shots keys can only add. To fix a number you type the right one with SET.'; },
        setup: function (s) { midGame(s, { h: 3, v: 1, hs: 8 }); },
        steps: [
          { t: 'The board shows Home 3, but the ref says it should be 2. Press <b>SET</b>, then <b>HOME SCORE</b>.', keys: ['set', 'hscore'], check: function (s) { return inMode(s, 'entry') && /HOME/.test(s.mode.label); } },
          { t: 'Type <b>2</b>, then press <b>YES</b>.', keys: ['d2', 'yes'], check: function (s) { return s.H.score === 2 && !s.mode; } },
          { t: 'Guest should have 2: <b>SET</b>, <b>GUEST SCORE</b>, <b>2</b>, <b>YES</b>.', keys: ['set', 'vscore', 'd2', 'yes'], check: function (s) { return s.V.score === 2; } },
          { t: 'Shots work the same way. Home should have 10: <b>SET</b>, <b>HOME SHOTS</b>, <b>1 0</b>, <b>YES</b>.', keys: ['set', 'hsog', 'd1', 'd0', 'yes'], check: function (s) { return s.H.sog === 10; } }
        ],
        wrap: 'SET, the key, the right number, YES. That fixes any score or shot count.'
      },
      {
        id: 'shots', title: 'Count shots on goal', sub: 'While the clock keeps running',
        intro: function () { return 'Shots happen often and the clock keeps running. A shot counts only if the goalie stops it or it goes in.'; },
        setup: function (s) { midGame(s, { running: true, hs: 3, vs: 2 }); },
        steps: [
          { t: 'Home shoots, the goalie catches it, play goes on. Press <b>HOME SHOTS</b>, then <b>1</b>.', keys: ['hsog', 'd1'], check: function (s, p) { return s.H.sog === p.H.sog + 1; } },
          { t: 'Another home shot, saved. The display still shows H.SHOTS with a "+", so you can just press <b>1</b> again.', keys: ['d1'], check: function (s, p) { return s.H.sog === p.H.sog + 1; } },
          { t: 'Guest shot, saved. Press <b>GUEST SHOTS</b>, then <b>1</b>.', keys: ['vsog', 'd1'], check: function (s, p) { return s.V.sog === p.V.sog + 1; } },
          { t: 'The goalie covers the puck and the ref whistles. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } }
        ],
        wrap: 'Missed nets, blocked shots and shots off the post are not shots on goal. If you are unsure, check with the official scorer between periods.'
      },
      {
        id: 'minor', title: 'Enter a penalty', sub: 'SET, PENALTY, time, YES, player, YES',
        intro: function () { return 'The referee signals a penalty: Guest #7, tripping, a ' + minorStr() + ' minor. Play already stopped, so the clock is off.'; },
        setup: function (s) { midGame(s, { h: 1 }); },
        steps: [
          { t: 'Press <b>SET</b>, then <b>GUEST PENALTY</b>. The display shows PEN MM:SS.', keys: ['set', 'vpen'], check: function (s) { return inMode(s, 'entry') && s.mode.mask === 'MM:SS'; } },
          { t: function () { return 'Type the penalty time from the left: <b>' + spaced(minorKeys()) + '</b> for ' + minorStr() + '.'; }, keys: function () { return minorKeys(); }, check: function (s) { return inMode(s, 'entry') && s.mode.mask === 'MM:SS' && E.consoles.nevco.timeMs(s.mode.digits, false) === cfg.minor * SEC; } },
          { t: 'Press <b>YES</b>. The display asks for G.PLAYER #.', keys: ['yes'], check: function (s) { return inMode(s, 'entry') && /PLAYER/.test(s.mode.label); } },
          { t: 'Type <b>7</b>, then press <b>YES</b>. Player 7 and the time appear on the scoreboard.', keys: ['d7', 'yes'], check: function (s) { return hasPen(s, 'V', 7, cfg.minor * SEC); } },
          { t: 'Puck drop. Switch on and watch the penalty clock count down with the game clock.', keys: ['timein'], check: function (s) { return s.timeIn; } },
          { t: 'Whistle. Clock off. The penalty clock stops too.', keys: ['timein'], check: function (s) { return !s.timeIn; } }
        ],
        wrap: 'If you type a wrong digit, NO backs up one digit. NO on an empty line cancels the penalty.'
      },
      {
        id: 'pp', title: 'Power-play goal', sub: 'Show the penalty, then clear it',
        intro: function () { return 'Guest #7 is in the penalty box, so Home has an extra skater. That is a power play.'; },
        setup: function (s) { midGame(s, { running: true, h: 1, v: 1 }); E.addPenalty(s, 'V', '7', cfg.minor * SEC); s.V.pens[0].left = 52 * SEC; },
        steps: [
          { t: 'Whistle. Home scores on the power play! Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: 'Add the goal: <b>HOME SCORE</b>, then <b>1</b>.', keys: ['hscore', 'd1'], check: function (s, p) { return s.H.score === p.H.score + 1; } },
          { t: 'The goal ends #7\'s minor, but the control will not clear it for you. Press <b>GUEST PENALTY</b>. The display shows the first guest penalty: G 1, the time left, and player 7.', keys: ['vpen'], check: function (s) { return inMode(s, 'recall') && s.mode.team === 'V'; } },
          { t: 'With #7 on the display, press <b>PENALTY CLEAR</b>. It asks CLEAR (Y-N).', keys: ['pclear'], check: function (s) { return inMode(s, 'confirm') && /CLEAR/.test(s.mode.q); } },
          { t: 'Press <b>YES</b>.', keys: ['yes'], check: function (s) { return !hasPen(s, 'V', 7); } }
        ],
        wrap: 'Only a minor ends early. A 5:00 major stays on even if the other team scores. With two penalties, press GUEST PENALTY again to show the next one before you clear.'
      },
      {
        id: 'morepens', title: 'More penalty situations', sub: 'Majors, a waiting penalty, the list',
        intro: function () { return 'The board shows two penalties per team. Extra penalties wait and start when one of the first two runs out.'; },
        setup: function (s) { midGame(s, {}); E.addPenalty(s, 'V', '7', cfg.minor * SEC); s.V.pens[0].left = 70 * SEC; E.addPenalty(s, 'V', '12', cfg.minor * SEC); },
        steps: [
          { t: function () { return 'Guest #22 also gets a ' + minorStr() + ' minor: <b>SET</b>, <b>GUEST PENALTY</b>, <b>' + spaced(minorKeys()) + '</b>, <b>YES</b>, <b>2 2</b>, <b>YES</b>.'; }, keys: function () { return R.penalty('V', 22, cfg.minor * SEC); }, check: function (s) { return hasPen(s, 'V', 22); } },
          { t: 'Only #7 and #12 show on the board. #22 is waiting. Switch on.', keys: ['timein'], check: function (s) { return s.timeIn; } },
          { t: 'Whistle. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: 'Now a major: Home #4, 5:00 for checking from behind. <b>SET</b>, <b>HOME PENALTY</b>, <b>0 5 0 0</b>, <b>YES</b>, <b>4</b>, <b>YES</b>.', keys: function () { return R.penalty('H', 4, 300 * SEC); }, check: function (s) { return hasPen(s, 'H', 4, 300 * SEC); } },
          { t: 'To look through the guest penalties, press <b>GUEST PENALTY</b> three times. Each press shows the next one.', keys: ['vpen', 'vpen', 'vpen'], check: function (s) { return inMode(s, 'recall') && s.mode.team === 'V' && s.mode.idx === 2; } }
        ],
        wrap: 'YES, NO or any other key closes the penalty list.'
      },
      {
        id: 'fixclock', title: 'Fix the clock', sub: 'When the ref wants time back',
        intro: function () { return 'The referee says the clock ran 3 seconds too long. It shows 8:15 and should show 8:18.'; },
        setup: function (s) { midGame(s, { clock: 495, h: 2, v: 2 }); E.addPenalty(s, 'V', '9', cfg.minor * SEC); s.V.pens[0].left = 61 * SEC; },
        steps: [
          { t: 'Press <b>SET</b>, then <b>TIME</b>.', keys: ['set', 'time'], check: function (s) { return inMode(s, 'entry') && s.mode.mask === 'MM:SS.s'; } },
          { t: 'Type <b>0 8 1 8</b>, then <b>YES</b>.', keys: ['d0', 'd8', 'd1', 'd8', 'yes'], check: function (s) { return s.clock === 498 * SEC && inMode(s, 'period'); } },
          { t: 'It asks for the PERIOD. The period is fine, so press <b>NO</b> to keep it.', keys: ['no'], check: function (s) { return !s.mode && s.clock === 498 * SEC && s.period === 1; } },
          { t: 'The ref also wants #9\'s penalty at 1:00. Press <b>GUEST PENALTY</b> to show it, then <b>PENALTY EDIT</b>, <b>YES</b>, <b>0 1 0 0</b>, <b>YES</b>.', keys: function () { return ['vpen', 'pedit', 'yes'].concat(mmssKeys(60), ['yes']); }, check: function (s) { var x = E.findPen(s, 'V', 9); return !!x && x.left === 60 * SEC; } }
        ],
        wrap: 'Changing the clock leaves the penalty times alone. Edit a penalty only when the ref tells you to.'
      },
      {
        id: 'endperiod', title: 'End a period', sub: 'Horn, then SET TIME for the next one',
        intro: function () { return 'The period ends when the clock hits zero. The auto horn sounds by itself.'; },
        setup: function (s) { midGame(s, { clock: 7, running: true, h: 2, v: 1 }); },
        steps: [
          { t: 'Let the clock run out and listen for the horn.', keys: [], check: function (s) { return s.clock === 0; } },
          { t: 'Switch off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: function () { return 'Set up period 2 in one go: <b>SET</b>, <b>TIME</b>, <b>' + spaced(clockKeys(cfg.periodLen)) + '</b>, <b>YES</b>, then <b>2</b> for the period.'; }, keys: function () { return R.nextPeriod({ period: 1 }); }, check: function (s) { return s.period === 2 && s.clock === cfg.periodLen * SEC && !s.mode; } }
        ],
        wrap: 'Setting the clock is also how you change the period. Penalties still running carry into the next period. Leave them.'
      },
      {
        id: 'timeout', title: 'Timeouts', sub: 'The 30-second time out timer',
        intro: function () { return 'When a coach calls a timeout, play stops. The control has a 30-second time out timer ready to go.'; },
        setup: function (s) { midGame(s, { running: true }); },
        steps: [
          { t: 'Whistle: Home calls a timeout. Clock off.', keys: ['timein'], check: function (s) { return !s.timeIn; } },
          { t: 'Press <b>TIME OUT TIMER START</b>. The display asks TIMER # (0-9)?', keys: ['totstart'], check: function (s) { return inMode(s, 'timer'); } },
          { t: 'Press <b>0</b> for the standard 30-second timer. It counts down on the display.', keys: ['d0'], check: function (s) { return !!s.timeout; } },
          { t: 'The teams line up for the faceoff. Switch on: the game clock takes over again.', keys: ['timein'], check: function (s) { return s.timeIn && !s.timeout; } }
        ],
        wrap: 'Many youth games do not run the timeout timer. Ask your rink if they want you to use it.'
      },
      {
        id: 'newgame', title: 'Start a new game', sub: 'Power on, NO, NO, 871',
        intro: function () { return 'The control remembers the last game. To start fresh, turn it off and on and answer its questions.'; },
        setup: function (s) { midGame(s, { clock: 0, period: 3, h: 4, v: 2, hs: 21, vs: 17 }); E.addPenalty(s, 'H', '11', cfg.minor * SEC); },
        steps: [
          { t: 'Press <b>POWER</b> to turn the control off. The scoreboard stays on.', keys: ['power'], check: function (s) { return !s.power; } },
          { t: 'Press <b>POWER</b> again. The display scrolls START WHERE TURNED OFF LAST?', keys: ['power'], check: function (s) { return s.power && s.boot && s.boot.stage === 'resume'; } },
          { t: 'YES would carry on with the last game (that is for a power cut). You want a fresh game: press <b>NO</b>.', keys: ['no'], check: function (s) { return s.boot && s.boot.stage === 'bookmark'; } },
          { t: 'It asks GO TO A BOOKMARK? Press <b>NO</b>.', keys: ['no'], check: function (s) { return s.boot && s.boot.stage === 'model'; } },
          { t: 'ENTER YOUR MODEL CODE: it is printed on the overlay. Type <b>8 7 1</b>.', keys: ['d8', 'd7', 'd1'], check: function (s) { return s.boot && s.boot.stage === 'pto'; } },
          { t: 'It shows HOCKEY, then asks DO YOU WANT TO USE PENALTY TIME OUT? Press <b>NO</b>, so penalty clocks always follow the game clock.', keys: ['no'], check: function (s) { return !s.boot && s.H.score === 0 && s.V.score === 0 && !s.H.pens.length; } }
        ],
        wrap: 'The board is cleared and the clock shows 0:00.0. Now set the period clock with SET, TIME (lesson 3).'
      }
    ];

    /* ---------- cheat sheet ---------- */
    function sheet() {
      return {
        intro: 'Your rules: ' + fmt(cfg.periodLen) + ' periods, ' + minorStr() + ' minors, 5:00 majors. Times are typed from the left: minutes, then seconds. YES saves, NO backs up a digit.',
        cards: [
          { title: 'Every whistle', rows: [
            ['Puck drops', ['timein'], 'Hand switch ON. Clock runs.'],
            ['Whistle', ['timein'], 'Hand switch OFF. Clock stops.'],
            ['Horn by hand', ['horn'], 'Hold it down.']] },
          { title: 'Goals and shots', rows: [
            ['Home goal', ['timein'].concat(R.goal('H')), 'Clock off, goal, then shot.'],
            ['Guest goal', ['timein'].concat(R.goal('V'))],
            ['Shot on goal (clock keeps running)', R.shot('H')],
            ['Fix a score (Home should be 2)', ['set', 'hscore', 'd2', 'yes'], 'Score keys only add, so type the right number.'],
            ['Fix shots (Guest should be 12)', ['set', 'vsog', 'd1', 'd2', 'yes']],
            ['Never use for goals', ['hgoal'], 'Only switches the goal light.']] },
          { title: 'Penalties', rows: [
            ['Minor ' + minorStr() + ', Guest #7', R.penalty('V', 7, cfg.minor * SEC)],
            ['Major 5:00, Home #4', R.penalty('H', 4, 300 * SEC)],
            ['Power-play goal: clear it', ['vpen', 'pclear', 'yes'], 'Press GUEST PENALTY until the player shows first.'],
            ['Change a penalty time', ['vpen', 'pedit', 'yes', 'd0', 'd1', 'd0', 'd0', 'yes'], 'With the penalty showing.'],
            ['Look through penalties', ['vpen'], 'Each press shows the next one.']] },
          { title: 'Clock and periods', rows: [
            ['Set the clock to ' + fmt(cfg.periodLen) + ', period 2', R.nextPeriod({ period: 1 }), 'The last key is the period.'],
            ['Fix the clock (8:18)', R.fixClock(498), 'NO at PERIOD keeps the period.'],
            ['Fix only the period', ['set', 'time', 'no', 'd2'], 'NO skips the time.'],
            ['Timeout (30 seconds)', ['timein', 'totstart', 'd0']]] },
          { title: 'Start and oops', rows: [
            ['New game', ['power', 'power', 'no', 'no', 'd8', 'd7', 'd1', 'no'], 'Off, on, NO, NO, model code 871, NO.'],
            ['Back after a power cut', ['yes'], 'YES to START WHERE TURNED OFF LAST?'],
            ['Typed a wrong digit', ['no'], 'Backs up one digit.'],
            ['Changed your mind', ['set'], 'Press SET again to cancel it.']] }
        ],
        screen: { style: 'led', note: 'These scroll across the red display above the keypads. Longer messages scroll, just like on the control.', list: [
          [' 8:00.0      DN', 'The game clock. DN means it counts down.'],
          ['HOME          3+', 'Ready to add: press a number to add it to the score.'],
          ['SET MM:SS.s', 'Setting the clock. Type minutes and seconds from the left, then YES.'],
          ['PERIOD         1', 'Press the period number, or NO to keep it.'],
          ['PEN MM:SS', 'Type the penalty time, then YES.'],
          ['G 1 1:20       7', 'Penalty 1 on the guest list: 1:20 left, player 7.'],
          ['CLEAR (Y-N)', 'YES clears the penalty that was showing.'],
          ['ENTRY ERROR', 'That key does nothing right now. Read the display and try again.'],
          ['START WHERE TURNED OFF LAST?', 'After power-on. YES carries on, NO starts fresh.']] },
        source: 'From Nevco\'s Scoreboard Operator\'s Instructions for the MPC Control, Hockey, model code 871 (135-0066). Unofficial. Check against your rink\'s control before your first game.'
      };
    }

    function startNote() {
      return 'Your rink\'s Nevco control should have the <b>hockey overlay</b> on it, with <b>Model Code 871</b> printed at the top. The visiting team is called <b>GUEST</b> on this control.';
    }

    // [[key key]] marks a key sequence; the page draws it as key chips
    var routine = [
      ['Before puck drop', [
        'Turn the control on. At START WHERE TURNED OFF LAST? press [[no]], then [[no]] again for the bookmark question.',
        'Type the model code [[d8 d7 d1]], then answer [[no]] to "use penalty time out".',
        'Set the period clock: [[set time]], type the minutes, [[yes]], then [[d1]] for period 1.',
        'Check the board shows 0 to 0, period 1, the right time.',
        'Make sure the hand switch is off.']],
      ['During each period', [
        'Puck drops: hand switch on.',
        'Whistle: hand switch off.',
        'Goal: stop the clock, SCORE then 1, SHOTS then 1.',
        'Penalty: stop the clock, SET, PENALTY, time, YES, player, YES.',
        'Power-play goal: show the minor with PENALTY, then PENALTY CLEAR, YES.']],
      ['Between periods', [
        'Let the horn sound at 0:00, then switch off.',
        '[[set time]], type the minutes, [[yes]], then the new period number.',
        'Penalties still on the board carry over to the next period. Leave them.']]
    ];
    var consoleTip = 'The hand-held switch on the right runs the clock, as it does at the rink. On a computer: <b>space bar</b> flips the switch, number keys type, <b>Enter</b> is YES, <b>Backspace</b> is NO.';

    return {
      html: html, mounted: mounted, update: update, keyLabel: keyLabel, info: INFO,
      lessons: LESSONS, recipes: R, sheet: sheet, startNote: startNote, routine: routine, consoleTip: consoleTip
    };
  }

  root.Consoles = root.Consoles || {};
  root.Consoles.nevco = {
    id: 'nevco',
    name: 'Nevco MPC',
    maker: 'Nevco',
    lookFor: 'Light grey control with a red LED display across the top, two keypads side by side, and a hand-held switch on a coiled cord.',
    teams: { H: 'HOME', V: 'GUEST' },
    switchName: 'hand switch',
    kbd: { enter: 'yes', back: 'no' },
    lcdLines: 1,
    make: make
  };
})(this);
