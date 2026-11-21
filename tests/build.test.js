const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {readFileSync, existsSync, readdirSync} = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('production build includes every local entry-point asset in a self-contained publish folder', () => {
  const built = spawnSync('npm', ['run', 'build'], {cwd: root, encoding:'utf8'});
  assert.equal(built.status, 0, built.stdout + built.stderr);
  const publish = path.join(root, 'site');
  const html = readFileSync(path.join(publish, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(ref=>!/^https?:/.test(ref));
  for(const ref of refs) assert.ok(existsSync(path.resolve(publish,ref)), `Missing published asset: ${ref}`);
  assert.ok(readFileSync(path.join(publish,'dist/output.css'),'utf8').length>1000, 'Built stylesheet must be nonempty');
  assert.ok(existsSync(path.join(publish,'icons/calculator.svg')));
  assert.deepEqual(readdirSync(publish).sort(), ['dist','icons','index.html','src']);
  assert.deepEqual(readdirSync(path.join(publish,'src')).sort(), ['app.js','calculator.js','filesystem.js']);
});
