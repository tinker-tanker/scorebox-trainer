# Scorebox Trainer

A practice web app for hockey parents learning to run the scoreboard console in the scorer's box. Pick the console your rink has, then learn it step by step.

**Consoles:**

- **Fair-Play MP-70/50** (Trans-Lux Fair-Play) with the hockey keypad
- **Nevco MPC** with the hockey overlay (model code 871)
- Daktronics All Sport 5000: coming next

**What's in it** (for each console):

- **Start here**: an overview: what's inside, the consoles we support, hockey timing basics, the game-day routine
- **Setup bar** (top of Lessons, Practice, Free play and the Cheat sheet): switch console and set your league's rules (period length, 1:30 or 2:00 minors, tenths in the last minute)
- **Lessons**: 13 guided lessons; the keys to press light up on the console in order
- **Practice**: timed drills (whistle and faceoff reaction, a full period, penalty trouble, fix the board)
- **Free play**: a mid-game board to experiment on, with an "explain keys" mode
- **Cheat sheet**: every common task as a key sequence, plus what the console's screen messages mean

**Use it:** https://trainer.kiwistats.com (`#fairplay` or `#nevco` opens that console's lessons)

Also published as a Claude artifact: https://claude.ai/artifact/8j21QRvwECDfJV5tskGBGu

## Files

- `scorebox/index.html`: page layout and styles
- `scorebox/engine.js`: the shared game core (clock, scores, penalty clocks, scoreboard output) and the Fair-Play console's keys and screen. Other consoles register in `Engine.consoles`.
- `scorebox/nevco-engine.js`: the Nevco MPC's keys and display
- `scorebox/fairplay.js`, `scorebox/nevco.js`: each console's keypad drawing, key explanations, lessons, task recipes (which keys do a job), cheat sheet and game-day routine
- `scorebox/app.js`: the shared shell: console picker, scoreboard, sound, lesson and drill runner, panels, cheat sheet
- `tests/consoles.test.js`: engine tests for both consoles (`node tests/consoles.test.js`)

Drills describe what happens on the ice and check the scoreboard, not keystrokes; each console module supplies the keys for each task. Adding a console means a new engine file and a new UI module.

`index.html` is written as an Artifact page body: it has no `<!doctype>`, `<html>` or `<head>` wrapper because the publisher adds them. `build.js` wraps it in a full HTML document and writes a standalone site to `_site/`.

## Deploying

Hosted on Vercel (project `scorebox-trainer`, domain `trainer.kiwistats.com`, next to the KiwiStats app). Every push to `main` deploys: Vercel runs `node build.js` and serves `_site/`, as set in `vercel.json`. To preview locally, run `node build.js` and serve the `_site` folder with any static file server.

## Source and accuracy

- Fair-Play: *MP-70/50 Series Scoreboard Controller User Guide* (document 98-0002-29)
- Nevco: *Scoreboard Operator's Instructions, MPC Control, Hockey, model code 871* (135-0066)

Screen text matches the manuals where they show it; other screens are approximations. This project is unofficial and not affiliated with any scoreboard maker.

## To do

- Add the Daktronics All Sport 5000 (needs its hockey manual)
- Nevco: check against a real control how a one-digit player number is entered (the manual mentions a leading blank) and whether adding a goal lights the goal light by itself
- Fair-Play: confirm on a real console what `+3` enters, and whether a typed period length is kept for the next period
