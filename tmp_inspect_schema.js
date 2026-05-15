const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'packages', 'db', 'src', 'schema', 'organizations.ts');
const txt = fs.readFileSync(p, 'utf8');
const idx = txt.indexOf('pgTable("organizations")');
console.log('idx', idx);
if (idx >= 0) {
  console.log(txt.slice(idx, idx + 120));
}
const lines = txt.split(/\r?\n/);
const line = lines[16];
console.log('line17', JSON.stringify(line));
console.log('charCodes', line.split('').map(ch => ch.charCodeAt(0)));
