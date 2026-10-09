const fs = require('fs');
const path = require('path');

const dirs = ['src', 'public'];
const extra = ['package.json', 'postcss.config.js', 'tailwind.config.js'];
const out = [];

function add(rel) {
  const full = path.join(__dirname, rel);
  if (!fs.existsSync(full)) return;
  const ext = path.extname(rel).toLowerCase();
  const binary = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf', '.eot'].includes(ext);
  const data = fs.readFileSync(full, binary ? 'base64' : 'utf8');
  out.push({ file: rel.replace(/\\/g, '/'), data, encoding: binary ? 'base64' : 'utf8' });
}

function walk(dir) {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) return;
  for (const name of fs.readdirSync(full)) {
    const rel = path.join(dir, name);
    const stat = fs.statSync(path.join(__dirname, rel));
    if (stat.isDirectory()) walk(rel);
    else add(rel);
  }
}

dirs.forEach(walk);
extra.forEach(add);

fs.writeFileSync('vercel-files.json', JSON.stringify(out));
console.log('Files:', out.length);
