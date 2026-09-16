# Contributing to poe2perfect

Thanks for taking a look. Bug reports, ideas and pull requests are welcome.

## Licensing of contributions

poe2perfect is licensed under the [GNU GPL v3.0 or later](LICENSE). By sending a pull request you agree that your
contribution is licensed under the same terms, and that you have the right to license it.

Sign your commits off with `git commit -s` (the [Developer Certificate of Origin](https://developercertificate.org/)),
which adds a `Signed-off-by` line to the commit message.

## Getting started

```sh
npm install
npm run dev        # dev build in .output/chrome-mv3-dev — load it unpacked in Chrome
npm test           # Vitest
npm run typecheck
npm run build      # production build
```

Load `.output/chrome-mv3-dev` through `chrome://extensions` → Developer mode → Load unpacked. It reloads on save;
manifest changes (permissions, matches) need the reload button on the extension card.

## How the code is laid out

- `src/lib/` — parsing the site's data, tooltip and layout models, page state. No UI.
- `src/ui/` — Preact components per tab, plus the shadow-root mount and the design tokens.
- `src/entrypoints/` — the content script (and a dev-only popup).
- `docs/PLAN.md` — how the extension was built step by step, and what the site's data looks like.
- `reference/DESIGN.md`, `reference/interface.md` — design system and screen layouts.

## Working style

- Tests first: write a failing test, then make it pass. `npm test`, `npm run typecheck` and `npm run build` must all
  pass before a pull request.
- Every string the user sees is in English.
- Layouts stay compact: a tab should fit one screen, cards fill the height they are given.

## Test fixtures

`tests/fixtures/*.json` are captured from real build pages with the dev popup ("Экспорт фикстуры"). The capture
replaces the guide's wording with placeholder words and drops other people's comments, so only build data and game
data are stored here — please keep it that way and take expected text from the fixture data in tests.

## Extension icons

`public/icon/*.png` are drawn by `python scripts/make-icons.py`.
