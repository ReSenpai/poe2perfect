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
  manifest: ({ browser, mode }) => {
    const manifest = manifestFor(browser, version, firefoxBuild);
    if (mode !== 'development') return manifest;
    // Dev only: the dev background takes screenshots of the tab for the store and README and saves them to Downloads.
    return { ...manifest, permissions: [...manifest.permissions, 'downloads'], host_permissions: ['<all_urls>'] };
  },
  // Manifest V3 in Firefox too (WXT builds MV2 for it by default), so both browsers follow the same rules.
  manifestVersion: 3,
  // The sources ZIP addons.mozilla.org asks for: what builds the extension, not store material or notes. The store and
  // Boosty image scripts live in this folder but outside git (.git/info/exclude), so they stay out here too.
  zip: {
    excludeSources: [
      'store/**',
      'docs/images/**',
      'reference/**',
      'scripts/__pycache__/**',
      'scripts/brand.py',
      'scripts/make-store-assets.py',
      'scripts/make-boosty-*.py',
    ],
  },
  // Dev build is loaded manually into the everyday Chrome (mobalytics sits behind Cloudflare).
  webExt: { disabled: true },
  hooks: {
    // The popup and the background only host dev tools (fixture export, screenshots) for now.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode !== 'production') return;
      for (const name of ['popup', 'background']) {
        const index = entrypoints.findIndex((entrypoint) => entrypoint.name === name);
        if (index !== -1) entrypoints.splice(index, 1);
      }
    },
  },
  vite: () => ({
    plugins: [preact()],
  }),
});
