const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const checkedFiles = ['index.html', 'script.js', 'style.css', 'manifest.json'];
const pictographPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const legacyGlyphHelper = 'getWeather' + 'Emo' + 'ji';

test('UI sources use SVG icons instead of pictograph glyphs', () => {
  for (const file of checkedFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(pictographPattern.test(source), false, `${file} contains pictograph glyphs`);
    assert.equal(source.includes(legacyGlyphHelper), false, `${file} still references the old weather glyph helper`);
  }
});
