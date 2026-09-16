# poe2perfect

Chrome extension (MV3): replaces a PoE 2 build page on mobalytics.gg with a clean tabbed UI.
Repo folder is still `mobalyticsgg-sugar`; internal ids (shadow host `poe2-build-guide`, `data-poe2-build-guide-*`
attributes, dev events) keep the old name on purpose — renaming them would break stored state and dev hooks.

- Plan and data findings: `docs/PLAN.md` — read before starting a step, tick steps off when done.
- Design: `reference/DESIGN.md`, screen layouts: `reference/interface.md`, concept art in `reference/`.
- Sample build: https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit

## Workflow (user requirements)

- Work step by step following `docs/PLAN.md`. One step at a time; don't start the next without the user.
- Strict TDD: write failing tests first, confirm red, then implement to green, then refactor.
- Before finishing a step: tests, typecheck and build all pass.
- Verify UI yourself in Chrome (claude-in-chrome): open the build page, take screenshots, compare with concept.
- Step report in Russian, short: what was done + a brief "что проверить руками" list (omit if nothing).
- All extension UI text is English (labels, buttons, empty states, errors, aria-labels).
- UI layouts: compact, ideally one screen; cards fill the available height; blocks side by side rather than a narrow
  column; minimal chrome (quiet icon buttons in existing bars, no bulky bordered buttons). Re-check the concept art.

## Commands

- `npm test` · `npm run typecheck` · `npm run build` — all must pass before a step is done.
- `npm run dev` — dev server on :3000; the user loaded `.output/chrome-mv3-dev` unpacked in Chrome,
  it auto-reloads on save (verified). Keep the dev server running while verifying in the browser.
- Content-script marker for quick checks: `document.documentElement.getAttribute('data-poe2-build-guide')`.
- Live capture check (dev build): `document.dispatchEvent(new Event('poe2-build-guide:capture'))`, then poll
  `data-poe2-build-guide-capture` on `<html>` for a JSON report.
- Live parser check (dev build): `document.dispatchEvent(new Event('poe2-build-guide:parse'))`, then poll
  `data-poe2-build-guide-parse` on `<html>` for a `BuildSummary` JSON.
- Rich text preview (dev build): `document.dispatchEvent(new Event('poe2-build-guide:preview'))` toggles a
  panel with every guide text rendered by `<RichText>` (shadow root `poe2-build-guide-preview`).
- Shadow-root UI CSS is passed inline (`import css from '...css?inline'`, `createShadowRootUi({ css })`);
  dev-only modules that pull in Preact/CSS must be loaded with `import()` inside `import.meta.env.DEV`.
- Real-data fixtures: `tests/fixtures/*.json` via `loadFixture(slug)` from `tests/fixtures/load.ts`.
  New ones come from the dev popup "Экспорт фикстуры" (user clicks; files land in Downloads).
- The repository is public: `captureFixture` scrubs guide wording (placeholder words) and drops other people's
  comments and featured builds, so tests take expected text from the fixture data (`textNodes` in the loader).
- Manifest changes (permissions, host matches, web-accessible resources) are NOT applied by WXT hot reload:
  ask the user to press reload on the extension card in `chrome://extensions`.
- Stopping the dev task may leave the WXT node process alive on :3000 (a restart then lands on :3001 and the loaded
  extension stops reloading). Check with `Get-NetTCPConnection -LocalPort 3000` and stop the stale `wxt.mjs` process.
- UI state checks: shadow host `poe2-build-guide` (`.overlay`, `.launcher`, `[role=status]`, `[role=alert]`).
- claude-in-chrome can't open `chrome-extension://` pages; unpacked extension id is derived from the path.

## Public snapshot

The public repository (github.com/ReSenpai/poe2perfect, GPL-3.0) gets a single-commit snapshot, without the store
and Boosty material, which stays here:

```sh
git branch -D public-main; git checkout --orphan public-main
git add -A                       # stage everything first
git rm -r --cached -q store scripts/brand.py scripts/make-store-assets.py scripts/make-boosty-assets.py
git commit -m "poe2perfect <version>"
git push --force https://github.com/ReSenpai/poe2perfect.git public-main:main
git switch main
```

## Site data notes

- Build data: `<script>` starting with `window.__PRELOADED_STATE__=` → JSON. Content scripts run in an
  isolated world, so parse the script tag text, don't read `window.__PRELOADED_STATE__`.
- Game static data (gems, passives, tree graph, items): site's IndexedDB `ngf-static-data`, store `cache`,
  key `poe-2|<hash>`, ~17.5 MB. Never commit it whole — fixtures hold only the needed subset.
- `curl` is blocked by Cloudflare — capture fixtures from the real browser.
- The site is an SPA: client-side navigation does not refresh `__PRELOADED_STATE__`.
- Signed-in users get a client-rendered page: `__PRELOADED_STATE__` is ~500 bytes with no queries. Build pages are
  therefore fetched with `credentials: 'omit'` (signed-out HTML carries the full state); the current document is only
  used when it actually holds the build.
- In claude-in-chrome, `javascript_tool` output is truncated at ~1.5 KB and URLs with query strings
  get blocked — return small, URL-free summaries.
