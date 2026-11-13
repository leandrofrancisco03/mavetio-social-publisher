import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCheckout, assertHash, criticalHashes, PIN } from './verify-checkout.mjs';
import { patchSources, paths } from './apply.mjs';

export const ecosystem = `module.exports = { apps: [
  { name: 'backend', cwd: '/app/apps/backend', script: 'pnpm', args: 'start', env: { NODE_ENV: 'production' }, kill_timeout: 30000 },
  { name: 'frontend', cwd: '/app/apps/frontend', script: 'pnpm', args: 'start', env: { NODE_ENV: 'production' }, kill_timeout: 30000 },
  { name: 'orchestrator', cwd: '/app/apps/orchestrator', script: 'pnpm', args: 'start', env: { NODE_ENV: 'production' }, kill_timeout: 60000 }
] };
`;
export function imageRecipe(dockerfile, dockerignore) {
  assertHash('Dockerfile.dev', dockerfile, criticalHashes['Dockerfile.dev']);
  assertHash('.dockerignore', dockerignore, criticalHashes['.dockerignore']);
  const startup = 'CMD ["sh", "-c", "nginx && pnpm run pm2"]';
  if (dockerfile.split(startup).length !== 2) throw new Error('Unexpected upstream startup');
  const result = dockerfile.replace('RUN pnpm install\n', 'RUN pnpm install --frozen-lockfile\n')
    .replace(startup, `LABEL org.opencontainers.image.revision="${PIN}"\nENV MAVETIO_DIRECT_POST=false\nEXPOSE 5000\nCMD ["sh", "-c", "nginx && exec pnpm exec pm2-runtime /app/mavetio/ecosystem.config.cjs"]`);
  return { dockerfile: result, dockerignore: dockerignore + '\n# Never bake deployment credentials into the image.\n**/.env\n**/.env.*\n**/.dev.vars*\n**/*.pem\n**/*.key\n**/backups\n**/*.dump\n**/dump.rdb\n**/appendonlydir\n' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node prepare-image.mjs <patched-checkout> [--check]');
  await verifyCheckout(root);
  const original = (path) => execFileSync('git', ['-C', root, 'show', `${PIN}:${path}`], { encoding: 'utf8' });
  const expected = patchSources(original(paths.controller), original(paths.provider));
  for (const name of ['controller', 'provider']) if (await readFile(join(root, paths[name]), 'utf8') !== expected[name]) throw new Error(`Patch differs: ${name}`);
  const helper = await readFile(new URL('./mavetio-tiktok.ts', import.meta.url), 'utf8');
  if (await readFile(join(root, paths.helper), 'utf8') !== helper) throw new Error('Helper revision differs');
  const recipe = imageRecipe(await readFile(join(root, 'Dockerfile.dev'), 'utf8'), await readFile(join(root, '.dockerignore'), 'utf8'));
  if (!process.argv.includes('--check')) {
    for (const target of ['Dockerfile.mavetio', 'Dockerfile.mavetio.dockerignore', 'mavetio/ecosystem.config.cjs']) {
      try { await access(join(root, target)); } catch { continue; }
      throw new Error(`Refusing to overwrite ${target}; use a fresh checkout`);
    }
    await mkdir(join(root, 'mavetio'), { recursive: true });
    await writeFile(join(root, 'Dockerfile.mavetio'), recipe.dockerfile);
    await writeFile(join(root, 'Dockerfile.mavetio.dockerignore'), recipe.dockerignore);
    await writeFile(join(root, 'mavetio/ecosystem.config.cjs'), ecosystem);
  }
  console.log('PASS: prepared/checked image recipe. No Docker build, start, database operation or deploy executed.');
}
