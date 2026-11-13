// Regression probe: local workerd only; no requests to Postiz, no credentials.
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
const contents = `export default {
  async fetch() {
    const result = {};
    for (const mode of ['error', 'manual']) {
      try {
        new Request('https://postiz.mavetio.com/api/public/v1/integrations', { redirect: mode });
        result[mode] = { ok: true };
      } catch (error) { result[mode] = { name: error.name, message: error.message }; }
    }
    return Response.json(result);
  }
}`;
const mf = new Miniflare({
  workers: [
    {
      config: {
        name: "redirect-regression",
        compatibilityDate: "2026-11-12",
        manifest: {
          mainModule: "index.js",
          modules: { "index.js": { type: "esm", contents } },
        },
      },
    },
  ],
});
try {
  const result = await (await mf.dispatchFetch("http://localhost/")).json();
  assert.equal(result.error.name, "TypeError");
  assert.equal(result.manual.ok, true);
  console.log(JSON.stringify(result));
} finally {
  await mf.dispose();
}
