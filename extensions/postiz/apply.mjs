import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PIN, verifyCheckout } from './verify-checkout.mjs';
export { PIN };
const directory = dirname(fileURLToPath(import.meta.url));
export const paths = {
  controller: 'apps/backend/src/public-api/routes/v1/public.integrations.controller.ts',
  provider: 'libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts',
  helper: 'libraries/nestjs-libraries/src/integrations/mavetio-tiktok.ts',
};
const hashes = { controller: '4f7de083c47e070b7203ebe10fc8cd8be75130031f9ad9d00d6d15310343ce40', provider: '9e44af8eafafe87a267185795c8b7cda13f583536250851ee675792a44de34a2' };
function once(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error('Patch anchor mismatch');
  return source.replace(anchor, replacement);
}
export function patchSources(controller, provider) {
  for (const [name, source] of Object.entries({ controller, provider })) {
    if (createHash('sha256').update(source).digest('hex') !== hashes[name]) throw new Error(`Unexpected ${name} source; use pristine ${PIN}`);
  }
  const helperImport = "import { queryCreator, validateDirect, creatorForOrganization } from '@gitroom/nestjs-libraries/integrations/mavetio-tiktok';\n";
  controller = "import { Header } from '@nestjs/common';\n" + helperImport + controller;
  controller = once(controller, "  @Post('/upload')", `  // Private Mavetio extension. Inherits PublicAuthMiddleware/API-key organization.
  @Get('/mavetio/tiktok/:id/creator-info')
  @Header('Cache-Control', 'private, no-store')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async mavetioCreator(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    if (process.env.MAVETIO_DIRECT_POST !== 'true') throw new HttpException('Direct Post extension disabled', 404);
    try { return await creatorForOrganization(org.id, id, (organization, channelId) => this._integrationService.getIntegrationById(organization, channelId)); }
    catch { throw new HttpException('Creator info unavailable or not authorized', 409); }
  }

  @Post('/upload')`);
  provider = helperImport + provider;
  const anchor = `    const videoPath = firstPost?.media?.[0]?.path!;`;
  provider = once(provider, anchor, `${anchor}
    // Recheck at execution time too. Never changes or refreshes tokens.
    if (process.env.MAVETIO_DIRECT_POST === 'true' && this.contentPostingMethod(firstPost) === 'DIRECT_POST') {
      try {
        if (isPhoto) throw new Error('Video only');
        const creator = await queryCreator(accessToken);
        validateDirect({ ...firstPost.settings, video_made_with_ai: firstPost.settings.video_made_with_ai ?? false } as any, creator);
      } catch {
        throw new BadBody('mavetio-direct-post', 'Creator restrictions do not allow this private video', Buffer.from('Creator restrictions do not allow this private video'));
      }
    }`);
  return { controller, provider };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node apply.mjs <pristine-postiz-checkout> [--check]');
  await verifyCheckout(root);
  const originals = await Promise.all([readFile(join(root, paths.controller), 'utf8'), readFile(join(root, paths.provider), 'utf8')]);
  const patched = patchSources(...originals);
  if (!process.argv.includes('--check')) {
    const helper = await readFile(join(directory, 'mavetio-tiktok.ts'), 'utf8');
    await mkdir(dirname(join(root, paths.helper)), { recursive: true });
    await writeFile(join(root, paths.helper), helper);
    await writeFile(join(root, paths.controller), patched.controller);
    await writeFile(join(root, paths.provider), patched.provider);
  }
  console.log(process.argv.includes('--check') ? 'Patch verified; no changes.' : 'Private extension applied locally. No deploy performed.');
}
