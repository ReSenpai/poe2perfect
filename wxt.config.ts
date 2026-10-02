import { readFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';
import { manifestFor } from './src/lib/build/manifest';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
// Set when signing a tester package unlisted while the release waits for review (.github/workflows/sign-xpi.yml).
const firefoxBuild = process.env.FIREFOX_BUILD ? Number(process.env.FIREFOX_BUILD) : undefined;

export default defineConfig({
  srcDir: 'src',
  // One manifest for Chrome and Firefox; Firefox adds its id and settings (src/lib/build/manifest.ts).
  manifest: ({ browser }) => manifestFor(browser, version, firefoxBuild),
  // Manifest V3 in Firefox too (WXT builds MV2 for it by default), so both browsers follow the same rules.
  manifestVersion: 3,
  // The sources ZIP addons.mozilla.org asks for: what builds the extension, not store material or notes.
  zip: { excludeSources: ['store/**', 'docs/images/**', 'reference/**'] },
  // Dev build is loaded manually into the everyday Chrome (mobalytics sits behind Cloudflare).
  webExt: { disabled: true },
  hooks: {
    // The popup only hosts dev tools (fixture export) for now.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode !== 'production') return;
      const popup = entrypoints.findIndex((entrypoint) => entrypoint.name === 'popup');
      if (popup !== -1) entrypoints.splice(popup, 1);
    },
  },
  vite: () => ({
    plugins: [preact()],
  }),
});
