import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const built = JSON.parse(await readFile(new URL('../dist/server/wrangler.json', import.meta.url), 'utf8'));
assert.deepEqual(built.vars, root.vars, 'Worker build variables differ from source');
assert.equal(built.vars.POSTIZ_API_URL, 'https://postiz.mavetio.com/api/public/v1');
for (const key of ['POSTIZ_API_KEY', 'MEDIA_SIGNING_SECRET']) {
  assert.equal(key in (root.vars || {}), false, `${key} must remain a secret`);
  assert.equal(key in (built.vars || {}), false, `${key} must not be in build vars`);
}
for (const key of ['workers_dev','preview_urls','compatibility_date','compatibility_flags','routes']) {
  assert.deepEqual(built[key], root[key], `Worker setting changed: ${key}`);
}
console.log('PASS: all vars propagated; Postiz base correct; Access identifiers preserved; no keys in vars; Workers security settings unchanged.');
