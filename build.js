// Builds a standalone site in _site/ for GitHub Pages.
// scorebox/index.html is an Artifact page body (no doctype or <head>), so wrap it in
// the same minimal document skeleton the Artifact publisher adds.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'scorebox');
const out = path.join(__dirname, '_site');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

const body = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), page);

for (const file of ['engine.js', 'app.js']) {
  fs.copyFileSync(path.join(src, file), path.join(out, file));
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');

console.log('Built', fs.readdirSync(out).join(', '));
