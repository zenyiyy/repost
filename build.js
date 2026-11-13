// Erzeugt bookmarklet.txt aus tt-cleaner.js  (npm i terser && node build.js)
const fs = require('fs');
const { minify } = require('terser');
minify(fs.readFileSync(__dirname + '/tt-cleaner.js', 'utf8'), {
  compress: true, mangle: true, format: { comments: false, ascii_only: true }
}).then(r => {
  const c = encodeURIComponent(r.code); // komplett kodiert, sonst lehnt iOS die URL ab
  fs.writeFileSync(__dirname + '/bookmarklet.txt', 'javascript:' + c + '\n');
  console.log('bookmarklet.txt:', c.length + 11, 'Zeichen');
});
