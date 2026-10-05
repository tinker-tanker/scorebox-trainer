// Run with: node tests/consoles.test.js
const assert = require('assert');
const E = require('../scorebox/engine.js');
require('../scorebox/nevco-engine.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}
function game(consoleId, cfg) { return E.newGame(Object.assign({ periodLen: 900, minor: 90 }, cfg), consoleId); }
function keys(s, ...ks) { ks.forEach(k => E.press(s, k)); }
function screen(s) { return E.lcd(s).join(' | ').trim(); }

/* ---------- Fair-Play MP-70 ---------- */

test('fair-play: minor penalty counts down only with the clock', () => {
  const s = game('fairplay');
  keys(s, 'vpen', 'plus3', 'd7', 'enter');
  assert.strictEqual(E.board(s).V.pens[0].time, '1:30');
  E.tick(s, 5000);
  assert.strictEqual(E.board(s).V.pens[0].time, '1:30');
  E.setTimeIn(s, true); E.tick(s, 10000);
  assert.strictEqual(E.board(s).V.pens[0].time, '1:20');
});

test('fair-play: power-play clear and clock correction prompt', () => {
  const s = game('fairplay');
  keys(s, 'vpen', 'plus3', 'd7', 'enter', 'vpen', 'd7', 'enter', 'enter');
  assert.strictEqual(s.V.pens.length, 0);
  keys(s, 'vpen', 'plus1', 'd9', 'enter', 'clockset', 'd8', 'd1', 'd8', 'enter');
  assert.match(screen(s), /CORR\.PENALTY\?Y\/N/);
  keys(s, 'shift', 'd6');
  assert.strictEqual(s.clock, 498000);
  assert.strictEqual(s.mode, null);
});

test('fair-play: ENTER before the player number', () => {
  const s = game('fairplay');
  keys(s, 'hpen', 'plus1', 'enter');
  assert.match(screen(s), /NO PENALTY FOUND/);
  assert.strictEqual(s.H.pens.length, 0);
});

/* ---------- Nevco MPC (model code 871) ---------- */

test('nevco: SET TIME fills left to right, then asks for the period', () => {
  const s = game('nevco');
  keys(s, 'set', 'time', 'd1', 'd3');
  assert.match(screen(s), /^SET 13:SS\.s/);
  keys(s, 'yes');
  assert.match(screen(s), /^PERIOD/);
  keys(s, 'd2');
  assert.strictEqual(s.clock, 13 * 60000);
  assert.strictEqual(s.period, 2);
  assert.match(screen(s), /13:00\.0\s+DN/);
});

test('nevco: score keys only add; SET + score types the exact score', () => {
  const s = game('nevco');
  keys(s, 'hscore', 'd1');
  assert.strictEqual(s.H.score, 1);
  assert.match(screen(s), /^HOME\s+1\+/);
  keys(s, 'set', 'hscore', 'd3', 'yes');
  assert.strictEqual(s.H.score, 3);
  keys(s, 'set', 'vsog', 'd1', 'd2', 'yes');
  assert.strictEqual(s.V.sog, 12);
});

test('nevco: penalty entry, recall and clear', () => {
  const s = game('nevco');
  keys(s, 'set', 'vpen', 'd0', 'd1', 'd3', 'd0');
  assert.match(screen(s), /^PEN 01:30/);
  keys(s, 'yes', 'd7');
  assert.match(screen(s), /^G\.PLAYER # 7_/);
  keys(s, 'yes');
  assert.deepStrictEqual(E.board(s).V.pens, [{ player: '7', time: '1:30' }]);
  E.setTimeIn(s, true); E.tick(s, 10000); E.setTimeIn(s, false);
  keys(s, 'vpen');
  assert.match(screen(s), /^G 1 1:20\s+7$/);
  keys(s, 'pclear');
  assert.match(screen(s), /^CLEAR \(Y-N\)/);
  keys(s, 'yes');
  assert.strictEqual(s.V.pens.length, 0);
});

test('nevco: penalty edit changes the time left', () => {
  const s = game('nevco');
  keys(s, 'set', 'hpen', 'd0', 'd5', 'yes', 'd4', 'yes');
  keys(s, 'hpen', 'pedit', 'yes', 'd0', 'd1', 'd3', 'd0', 'yes');
  assert.strictEqual(s.H.pens[0].left, 90000);
});

test('nevco: hand switch plugged in, so TIME ON is an entry error', () => {
  const s = game('nevco');
  keys(s, 'timeon');
  assert.match(screen(s), /ENTRY ERROR/);
  assert.strictEqual(s.timeIn, false);
  E.tick(s, 2100);
  assert.doesNotMatch(screen(s), /ENTRY ERROR/);
});

test('nevco: SET HORN asks about the auto horn', () => {
  const s = game('nevco');
  keys(s, 'set', 'horn');
  assert.match(screen(s), /AUTO HORN \? \(Y\/N\)/);
  keys(s, 'no');
  assert.strictEqual(s.autoHorn, false);
});

test('nevco: power on, start fresh with model code 871', () => {
  const s = game('nevco');
  keys(s, 'hscore', 'd4', 'power', 'power');
  assert.strictEqual(screen(s), 'START WHERE TURNED OFF LAST?');
  keys(s, 'no');
  assert.strictEqual(screen(s), 'GO TO A BOOKMARK?');
  keys(s, 'no', 'd8', 'd7', 'd1');
  E.tick(s, 1600);
  assert.strictEqual(screen(s), 'DO YOU WANT TO USE PENALTY TIME OUT?');
  keys(s, 'no');
  assert.strictEqual(s.H.score, 0);
  assert.strictEqual(s.clock, 0);
  assert.strictEqual(s.boot, null);
});

test('nevco: resume keeps the game after a power cut', () => {
  const s = game('nevco');
  keys(s, 'hscore', 'd4', 'power', 'power', 'yes');
  assert.strictEqual(s.H.score, 4);
});

console.log(passed + ' tests passed');
