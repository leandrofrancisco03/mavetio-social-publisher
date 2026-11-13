import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const PIN = 'a5affe62c74e39c1e7ac960d50d8418b807d532c';
export const criticalHashes = {
  'Dockerfile.dev': 'd1cf01577e6bbe716a924240ddaca1321b04474115a515ba50d726b1c2ec63bc',
  'package.json': '05a654eeb329685de5dc5f5a575e70778b57eb604bf3525000c40c91f11ad092',
  '.dockerignore': '7feef1b3d389b9b663f756ecd80a48433672cc532ab6f344d383935650de4f9a',
  'apps/backend/src/services/auth/public.auth.middleware.ts': '942df2bde2b70f8e6e19ab69b1f7f176f276104f4ce05bd09d802ce9c689aa2d',
  'apps/backend/src/public-api/public.api.module.ts': '079441bcefc36212934814caf54345b59e31efa154251746b0dc4d669725fd95',
  'libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts': '363de00f23b26160d4e2b60f4f3650a28a25edf6da621e22c6099aa6280c554d',
  'libraries/nestjs-libraries/src/database/prisma/integrations/integration.repository.ts': '2184062a50ddfbc9c2fd39865ed2c92b9eb03dbf7fd7bb978483bb307c3cf204',
};
export function assertCommit(head) {
  if (head.trim() !== PIN) throw new Error('Checkout must remain at the exact pinned upstream commit. Apply patches as working-tree changes before building.');
}
export function assertHash(path, content, expected) {
  if (createHash('sha256').update(content).digest('hex') !== expected) throw new Error(`Unexpected source hash: ${path}. Use a fresh checkout with core.autocrlf=false.`);
}
export async function verifyCheckout(root) {
  assertCommit(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }));
  const permittedChanges = new Set([
    'apps/backend/src/public-api/routes/v1/public.integrations.controller.ts',
    'libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts',
  ]);
  const changed = execFileSync('git', ['-C', root, 'diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  if (changed.some(path => !permittedChanges.has(path))) throw new Error('Unexpected tracked changes outside the extension; use a fresh checkout.');
  for (const [path, hash] of Object.entries(criticalHashes)) assertHash(path, await readFile(join(root, path)), hash);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node verify-checkout.mjs <checkout>');
  await verifyCheckout(process.argv[2]);
  console.log('PASS: exact upstream commit and critical security/build file hashes. Read-only check.');
}
