// Erzeugt bookmarklet.txt aus tt-cleaner.js  (npm i terser && node build.js)
const fs = require('fs');
const { minify } = require('terser');
minify(fs.readFileSync(__dirname + '/tt-cleaner.js', 'utf8'), {
  compress: true, mangle: true, format: { comments: false, ascii_only: true }
}).then(r => {
  const c = r.code.replace(/%/g, '%25').replace(/ /g, '%20').replace(/"/g, '%22').replace(/#/g, '%23');
  fs.writeFileSync(__dirname + '/bookmarklet.txt', 'javascript:' + c + '\n');
  console.log('bookmarklet.txt:', c.length + 11, 'Zeichen');
});
