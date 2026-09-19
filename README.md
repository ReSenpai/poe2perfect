# poe2perfect

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

A Chrome extension (Manifest V3) that shows Path of Exile 2 build guides from
[mobalytics.gg](https://mobalytics.gg/poe-2/builds) in a clean, tabbed view: Overview, Skills, Gear,
Passives, Atlas Tree and Progression, all on one screen with game tooltips.

Status: **1.0.0**. Unofficial, not affiliated with Mobalytics or Grinding Gear Games. Path of Exile is a trademark of
Grinding Gear Games; build guides and game data come from mobalytics.gg at run time and belong to their owners.

## Install the beta

1. Unzip `poe2perfect-1.0.0-chrome.zip` into a folder you keep (the browser loads the extension from it).
2. Open `chrome://extensions` (`edge://extensions` in Edge) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder that contains `manifest.json`.
4. Open any build, e.g. https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit

The tester guide (in Russian): `docs/beta-guide.html`.

To update, replace the folder contents with the new build and press the reload arrow on the extension card.

## Privacy

The extension runs only on mobalytics.gg, sends nothing anywhere else and keeps its display preferences in your
browser.
See [PRIVACY.md](PRIVACY.md).

## What it needs

- Permission: `storage` only (local display preferences: guide or original page, collapsed panels, and the tab and
  variant last read in each of the last 30 builds).
- Runs on `https://mobalytics.gg/*` and sends nothing anywhere else. Build data comes from the page itself;
  game data for tooltips comes from the site's own IndexedDB cache.

## ☕ Support the project

poe2perfect is a free, open-source Chrome extension. It is licensed under GPL-3.0 and costs nothing to use.

If the extension turned out useful and you would like to support further development, you can donate voluntarily:

**[☕ Support on Boosty](https://boosty.to/resenpai)**

Support is voluntary. It does not unlock features, access to the extension or any other advantages.

## License

poe2perfect is free software, released under the [GNU General Public License v3.0 or later](LICENSE).
You may use, study, share and change it; if you distribute a modified version, it must stay under the GPL with its
source code available. Copyright (C) 2026 ReSenpai.

The name "poe2perfect" and its logo are not covered by the license: forks need their own name and logo.
Third-party components and their licenses are listed in [NOTICE](NOTICE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: tests first, English UI strings, and contributions are licensed
under the GPL like the rest of the project.

## Development

```sh
npm install
npm run dev        # dev build in .output/chrome-mv3-dev (load it unpacked; reloads on save)
npm test           # Vitest
npm run typecheck
npm run build      # production build in .output/chrome-mv3
npm run zip        # .output/poe2perfect-<version>-chrome.zip
```

Stack: WXT, Preact, TypeScript, Vitest with happy-dom. The plan and findings about the site's data live in
`docs/PLAN.md`; the design system in `reference/DESIGN.md`. Icons are generated into `public/icon/`.
