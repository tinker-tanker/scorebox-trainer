# Scorebox Trainer

A practice web app for hockey parents learning to run the Trans-Lux Fair-Play MP-70/50 scoreboard console with the hockey keypad.

- **Start here**: hockey timing basics, league settings (period length, 1:30 or 2:00 minors), game-day routine
- **Lessons**: 13 guided lessons; the keys to press light up on the console in order
- **Practice**: timed drills (whistle and faceoff reaction, a full period, penalty trouble, fix the board)
- **Free play**: a mid-game board to experiment on, with an "explain keys" mode
- **Cheat sheet**: every common task as a key sequence, plus what the console screen messages mean

**Use it:** https://tinker-tanker.github.io/scorebox-trainer/

Also published as a Claude artifact: https://claude.ai/artifact/8j21QRvwECDfJV5tskGBGu

## Files

- `scorebox/index.html`: page layout and styles
- `scorebox/engine.js`: console emulator (keys, clock, penalties, LCD and scoreboard output). Runs in the browser or in Node.
- `scorebox/app.js`: lessons, drills, the on-screen console and scoreboard, sound, cheat sheet

`index.html` is written as an Artifact page body: it has no `<!doctype>`, `<html>` or `<head>` wrapper because the publisher adds them. `build.js` wraps it in a full HTML document and writes a standalone site to `_site/`.

## Deploying

Every push to `main` runs `.github/workflows/pages.yml`, which runs `node build.js` and publishes `_site/` to GitHub Pages. To preview locally, run `node build.js` and serve the `_site` folder with any static file server.

## Source and accuracy

Console behaviour follows the Fair-Play *MP-70/50 Series Scoreboard Controller User Guide* (document 98-0002-29). Screen text matches the manual where the manual shows it; other screens are approximations. This project is unofficial and not affiliated with Trans-Lux or Fair-Play.

## To do

- Add Daktronics All Sport and Nevco MPC consoles (needs their hockey manuals)
- Confirm on a real console: what `+3` enters, and whether a typed period length is kept for the next period
