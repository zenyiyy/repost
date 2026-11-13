// Erzeugt bookmarklet.txt aus tt-cleaner.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/tt-cleaner.js', 'utf8')
  .split('\n')
  .filter(l => !/^\s*\/\//.test(l))   // Kommentarzeilen raus
  .map(l => l.trim())
  .filter(Boolean)
  .join('\n');
fs.writeFileSync(__dirname + '/bookmarklet.txt', 'javascript:' + encodeURIComponent(src) + '\n');
console.log('bookmarklet.txt:', fs.statSync(__dirname + '/bookmarklet.txt').size, 'bytes');
