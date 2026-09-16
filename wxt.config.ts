import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'poe2perfect',
    description: 'A clean, tabbed view of Path of Exile 2 build guides on mobalytics.gg',
    permissions: ['storage'],
  },
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
