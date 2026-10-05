/* Fair-Play MP-70/50 (hockey keypad): keypad layout, key explanations, lessons, task recipes
   and cheat sheet. The key behaviour itself lives in engine.js. */
(function (root) {
  'use strict';

  function make(ctx) {
    var E = ctx.E, SEC = E.SEC, cfg = ctx.cfg, fmt = ctx.fmt;
    var midGame = ctx.midGame, inMode = ctx.inMode, hasPen = ctx.hasPen;

    function minorKey() { return cfg.minor === cfg.pen3 ? 'plus3' : 'plus1'; }
    function minorStr() { return fmt(cfg.minor); }
    // Fair-Play reads typed digits from the right as MMSS: 1300 = 13:00, 130 = 1:30
    function timeKeys(sec) {
      var m = Math.floor(sec / 60), s = sec % 60;
      return (String(m) + (s < 10 ? '0' : '') + s).split('').map(function (d) { return 'd' + d; });
    }
    function timeDigits(sec) { return timeKeys(sec).map(function (k) { return k.slice(1); }).join(' '); }
    var numKeys = ctx.numKeys;

    var KL = {
      settimer: ['Set Timer'], autohorn: ['Auto Horn'], clockset: ['Clock Set'], period: ['Period'],
      htimeout: ['Home Timeout', 'blue'], vtimeout: ['Visitor Timeout', 'yellow'], minus1: ['-1'],
      bridim: ['Bri. Dim'], hsog: ['Home S.O.G.', 'blue'], vsog: ['Visitor S.O.G.', 'yellow'], setint: ['Set Interval'],
      hpen: ['Home Penalty', 'blue'], vpen: ['Visitor Penalty', 'yellow'], plus3: ['+3'], plus2: ['+2'], plus1: ['+1'],
      hgoal: ['Home Goal', 'blue'], vgoal: ['Visitor Goal', 'yellow'], hscore: ['Home Score', 'blue'], vscore: ['Visitor Score', 'yellow'],
      clr: ['CLR', 'white'], enter: ['Enter', 'white'], shift: ['Shift', 'green'], timein: ['Time In', 'switch'], horn: ['Horn', 'switch']
    };
    function keyLabel(k) {
      if (/^d\d$/.test(k)) return [k.slice(1), 'white'];
      return KL[k] || [k, ''];
    }

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

    /* ---------- the console ---------- */
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
      var label = keyLabel(k[0])[0] + (k[2] ? ' (' + k[2] + ')' : '');
      return '<button type="button" class="key ' + (k[3] || extraCls || '') + (sub ? ' has-sub' : '') + '" data-key="' + k[0] + '" aria-label="' + label + '"><span>' + k[1] + '</span>' + sub + '</button>';
    }
    function html() {
      return '<div class="face">' +
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
    }
    function mounted(root) {
      var st = root.querySelector('#sticker3');
      if (st) st.textContent = ('0' + fmt(cfg.pen3)).slice(-5);
    }
    function update(s, root) {
      root.querySelector('#led').classList.toggle('on', s.autoHorn);
      root.querySelector('#led2').classList.toggle('on', s.autoHorn);
      ctx.updateSwitch(s, root);
      root.querySelector('[data-key="shift"]').classList.toggle('on', s.shift);
    }

    /* ---------- task recipes (drills, cheat sheet) ---------- */
    function penaltyKey(ms) { return ms === cfg.minor * SEC ? minorKey() : ms === 300 * SEC ? 'plus2' : 'plus1'; }
    var R = {
      goal: function (T) { var t = T.toLowerCase(); return [t + 'score', 'plus1', t + 'sog', 'plus1']; },
      shot: function (T) { return [T.toLowerCase() + 'sog', 'plus1']; },
      penalty: function (T, p, ms) { return [T.toLowerCase() + 'pen', penaltyKey(ms)].concat(numKeys(p), ['enter']); },
      clearPenalty: function (T, p) { return [T.toLowerCase() + 'pen'].concat(numKeys(p), ['enter', 'enter']); },
      setPenaltyTime: function (T, p, ms) { return [T.toLowerCase() + 'pen'].concat(numKeys(p), ['enter'], timeKeys(ms / SEC), ['enter']); },
      scoreDown: function (T) { return [T.toLowerCase() + 'score', 'minus1']; },
      shotUp: function (T) { return [T.toLowerCase() + 'sog', 'plus1']; },
      periodDown: function () { return ['period', 'minus1']; },
      fixClock: function (sec, s) { return ['clockset'].concat(timeKeys(sec), ['enter'], s && (s.H.pens.length || s.V.pens.length) ? ['shift', 'd6'] : []); },
      nextPeriod: function () { return ['period', 'plus1', 'clockset'].concat(timeKeys(cfg.periodLen), ['enter']); }
    };

    /* ---------- lessons ---------- */
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

    /* ---------- cheat sheet ---------- */
    function sheet() {
      var mk = minorKey(), dbl = [mk, mk];
      return {
        intro: 'Your rules: ' + fmt(cfg.periodLen) + ' periods, ' + minorStr() + ' minors (' + KL[mk][0] + ' key), 5:00 majors (+2 key). Blue keys are home, yellow keys are visitor. "Shift +" means hold SHIFT, then press the key.',
        cards: [
          { title: 'Every whistle', rows: [
            ['Puck drops', ['timein'], 'Switch ON. Clock runs.'],
            ['Whistle', ['timein'], 'Switch OFF. Clock stops.'],
            ['Horn by hand', ['horn'], 'Hold it down.']] },
          { title: 'Goals and shots', rows: [
            ['Home goal', ['timein'].concat(R.goal('H')), 'Clock off, goal, then shot.'],
            ['Visitor goal', ['timein'].concat(R.goal('V'))],
            ['Shot on goal (clock keeps running)', R.shot('H')],
            ['Take a goal away', R.scoreDown('H')],
            ['Type an exact score', ['hscore', 'd3', 'enter'], 'Same for S.O.G. and PERIOD.'],
            ['Never use for goals', ['hgoal'], 'Only switches the red light.']] },
          { title: 'Penalties', rows: [
            ['Minor ' + minorStr() + ', Visitor #7', ['vpen', mk, 'd7', 'enter']],
            ['Major 5:00, Home #4', ['hpen', 'plus2', 'd4', 'enter']],
            ['Double minor, #12', ['vpen'].concat(dbl, ['d1', 'd2', 'enter']), 'Press the time key twice.'],
            ['Power-play goal: clear #7', R.clearPenalty('V', 7), 'Minors only. Majors stay.'],
            ['Change a penalty time', ['vpen', 'd7', 'enter', 'd1', 'd0', 'd0', 'enter'], 'Type the new time (100 = 1:00).'],
            ['List all penalties', ['shift', 'vpen'], 'Press again to scroll.']] },
          { title: 'Clock and periods', rows: [
            ['Next period', ['period', 'plus1']],
            ['Set the clock to ' + fmt(cfg.periodLen), ['clockset'].concat(timeKeys(cfg.periodLen), ['enter']), 'TIME IN must be off.'],
            ['Fix the clock (8:18)', ['clockset', 'd8', 'd1', 'd8', 'enter']],
            ['...then keep penalty times', ['shift', 'd6'], 'Answers NO to CORR.PENALTY?'],
            ['Home timeout', ['timein', 'htimeout', 'minus1']]] },
          { title: 'Start and oops', rows: [
            ['New game (clears all)', ['shift', 'period', 'shift', 'd4']],
            ['Typed a wrong digit', ['clr'], 'Before ENTER. After ENTER, just enter it again.'],
            ['Stuck in a question', ['shift', 'clr'], 'ESC backs out.']] }
        ],
        screen: { style: 'lcd', note: 'These show up on the small green screen above the number keys. Here they look the same as on the console.', list: [
          ['HK', 'Hockey mode. BK means the break clock, OT overtime.'],
          ['ENTER PLY.NO.', 'Type the player number, then ENTER.'],
          ['NO PENALTY FOUND', 'ENTER was pressed before the number, or that player has no penalty. Start the penalty again.'],
          ['CORR.PENALTY?Y/N', 'You changed the clock while penalties run. SHIFT + 6 (NO) keeps them.'],
          ['NEW GAME? Y/N', 'SHIFT + 4 (YES) clears everything. SHIFT + 6 cancels.'],
          ['T.O.D.CLOCK? Y/N', 'Time of day. SHIFT + 6 (NO) brings the game clock back.']] },
        source: 'From the Fair-Play MP-70/50 Series User Guide (document 98-0002-29). Unofficial. Check against your rink\'s console before your first game.'
      };
    }

    function startNote() {
      return 'Your rink\'s console has a sticker on the <kbd class="k">+3</kbd> key that says <b>01:30</b>. Someone set that key to enter a 1:30 penalty. <kbd class="k">+1</kbd> enters 2:00 and <kbd class="k">+2</kbd> enters 5:00. If the sticker on your console says something different, ask the rink before your game.';
    }

    // [[key key]] marks a key sequence; the page draws it as key chips
    var routine = [
      ['Before puck drop', [
        'Find "HK" in the top-left of the console screen. That means hockey mode.',
        'Clear the last game: [[shift period]] (New Game), then [[shift d4]] (Yes).',
        'Set the period clock: [[clockset]], type the time, [[enter]].',
        'Check the board shows 0 to 0, period 1, the right time.',
        'Make sure TIME IN is off.']],
      ['During each period', [
        'Puck drops: TIME IN on.',
        'Whistle: TIME IN off.',
        'Goal: stop the clock, add the goal, add a shot.',
        'Penalty: stop the clock, enter it before the next faceoff.',
        'Power-play goal: clear the shorthanded player\'s minor.']],
      ['Between periods', [
        'Let the horn sound at 0:00, then flip TIME IN off.',
        '[[period plus1]]',
        '[[clockset]], type the time, [[enter]].',
        'Penalties still on the board carry over to the next period. Leave them.']]
    ];
    var consoleTip = 'On the real console you <b>hold</b> SHIFT while pressing the second key. Here, tap SHIFT and then the key. On a computer: <b>space bar</b> flips TIME IN, number keys type, <b>Enter</b> is ENTER, <b>Backspace</b> is CLR.';

    return {
      html: html, mounted: mounted, update: update, keyLabel: keyLabel, info: INFO,
      lessons: LESSONS, recipes: R, sheet: sheet, startNote: startNote, routine: routine, consoleTip: consoleTip
    };
  }

  root.Consoles = root.Consoles || {};
  root.Consoles.fairplay = {
    id: 'fairplay',
    name: 'Fair-Play MP-70',
    maker: 'Trans-Lux Fair-Play',
    lookFor: 'Grey control with blue HOME and yellow VISITOR keys, a green two-line screen and a TIME IN rocker switch on the right.',
    teams: { H: 'HOME', V: 'VISITOR' },
    switchName: 'TIME IN switch',
    kbd: { enter: 'enter', back: 'clr' },
    lcdLines: 2,
    make: make
  };
})(this);
