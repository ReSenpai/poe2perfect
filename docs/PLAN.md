# Implementation plan

A Chrome extension: a PoE 2 build page on mobalytics.gg → a clean tabbed interface.
Design: [reference/DESIGN.md](../reference/DESIGN.md), screen layouts: [reference/interface.md](../reference/interface.md).
Sample build: https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit

## Decisions

| Question | Decision |
|---|---|
| Stack | WXT + TypeScript (strict) + Preact + Vitest (+ happy-dom, @testing-library/preact) |
| Placement | Over the site's page, in Shadow DOM, with an "Original ↔ Extension" switch |
| Resistances and ES | Computed from items and passives, shown marked **beta** (approximate values) |
| Skill parameters | Taken from the site's game data (see below) |
| Hover tooltips | Everywhere, as on the site: items, runes/soul cores, skills, supports, passives |
| Passive tree | In the first version, the site's own tree, embedded in the Passives tab |

## Data sources

### 1. The build — `window.__PRELOADED_STATE__` in the HTML
The script `window.__PRELOADED_STATE__={…};` (~590 KB, valid JSON).
Path: `poe2State.apollo.graphqlV2.queries[]` → the query with `queryKey[0] === "ngf-ug-featured-document-page"`
→ `state.data[0].game.documents.userGeneratedDocumentBySlug.data` (`doc` from here on).

| What | Where in `doc` |
|---|---|
| Name, patch | `data.name` (`"[0.5.5] ED Contagion Lich League Starter (…)"`) |
| Class, ascendancy, build type | `tags.data[]` by `groupSlug` (`class`, `ascendancy`, `build-type`…) |
| Author, dates | `author`, `updatedAt` |
| Variants (Act 1 … Endgame Low Life) | widget `NgfDocumentCmWidgetContentVariantsV1` → `childrenVariants[]` (`id`, `title`, description) |
| A variant's gear | `data.buildVariants.values[id].equipment` — slots (`helmet`, `body`, `mainHand`, `offHand`, `leftRing`, `rightRing`, `amulet`, `belt`, `gloves`, `boots`, flasks, charms) → `commonItem` (slug, name, icon, `isUnique`, mods) + `runes`; `priorityList` — a list of **items** |
| A variant's skills | `…skillGems.gems[]` → `activeSkill` (slug, name, icon) + `subSkills[]` (supports: slug and icon) |
| Passive tree | `…passiveTree` → `mainTree.selectedSlugs` (`node-51184`…), `set1Tree`, `set2Tree`, `ascendancyTree`, `jewels` |
| Texts | `…RichTextSimplifiedV2` widgets (Build Overview, How it Plays), Equipment/SkillGems descriptions (stat priorities as text), `…StrengthsAndWeaknessesV1`, video |

Texts are Lexical editor JSON: paragraphs, headings, lists, links and inline "chips" of game entities
(`static-data-widget`: `id` = slug, `label`, `icon`, `groupId`).

### 2. Game data — the site's IndexedDB `ngf-static-data`
The site itself stores the full PoE 2 game data there (~17.5 MB, `cacheVersion`, 7-day TTL).
Store `cache`, the record keyed `poe-2|<hash>` → `staticData.game.staticData`. The content script runs on the same
domain and can read this database. The site's own tooltips work from it (hovering makes no network requests).

| Section | What it gives |
|---|---|
| `poe2Gems` | name, description, tags, stats per level (cast time, mana, requirements), `bakedDescriptions` — for skills and supports |
| `poe2PassiveSkills` | ~10,000 passives: name, icon, `notable` / `keystone`, effects |
| `poe2PassiveSkillsGraph` | tree geometry: groups, orbits, `node-N → passiveSlug`, edges |
| `poe2Armours`, `poe2Weapons`, `poe2Focuses`, `poe2Rings`, `poe2Amulets`… | items: bases, unique mods (ranges `(10-15)%`), requirements |
| `poe2SoulCores`, `poe2Prefixes`, `poe2Suffixes`, `poe2Jewels`, `poe2Ascendancies` | runes/soul cores, mods, jewels, ascendancies |

Risk: on the very first visit the database may not be written yet → we wait for it to appear; without the game data
the interface works, but without tooltips and parameters.

### Environment constraints
- Cloudflare blocks `curl` → fixtures are captured in a real browser.
- The site is an SPA: moving between builds without a reload brings no new `__PRELOADED_STATE__` →
  we fetch the page's HTML with `fetch` (same domain) or reload.
- The game data is never committed whole: fixtures hold only the records they need.

## How each step goes

1. **Red:** write tests for the step's behaviour, make sure they fail.
2. **Green:** the minimal implementation, tests pass.
3. **Refactor**, then `npm test`, `npm run typecheck`, `npm run build` — all clean.
4. **Live check** (where there is UI): open the build in Chrome, take screenshots, compare with the concept.
5. **Report:** briefly what was done + what to check by hand. Commit.

## Steps

### Step 0. Project skeleton ✅
WXT + TS + Preact + Vitest, `git init`, scripts `test` / `typecheck` / `build` / `dev`.
The content script on `https://mobalytics.gg/poe-2/builds/*` only sets a marker for now (an attribute on `<html>`).
- Tests: the build page URL matcher (build / not a build / build list / other games).
- Check: the build passes; with the extension loaded, the marker is visible on the page.
  Check whether the extension auto-reloads on rebuild.
- **By hand (once):** `chrome://extensions` → "Developer mode" → "Load unpacked" → the build folder.

### Step 1. Data extraction and fixtures ✅
- `extractBuildDocument(html | Document)` → `doc` or a typed error (no script / broken JSON / no query).
- `readStaticData()` — reads IndexedDB, waiting for it, and never creates the site's database;
  `pickStaticSubset(staticData, doc)` — picks the needed records.
- Dev export (dev build only): a popup button saves `<slug>.json` = `{ meta, build, staticData }`;
  for automated checks — the `poe2-build-guide:capture` event on `document`, report in the
  `data-poe2-build-guide-capture` attribute.
- Fixtures in `tests/fixtures/` (0.8–1 MB): Witch Lich, Mercenary Gemling, Ranger Pathfinder; loaded by `tests/fixtures/load.ts`.
- Tests on the fixtures: every gem, unique item and selected tree node is in the game data subset.

### Step 2. Build model and parser ✅
`parseBuild(doc, staticData | null) → Build` (`src/lib/build/`, model in `model.ts`): header, text sections in page
order, variants with gear, skills (parameters from the game data), passives and author's notes.
- The default variant is the **first** one (as on the site); the id `default-variant` is just the oldest variant.
- Item mods: an imported item's real values → affix ranges → the unique's ranges from the game data.
  Properties and requirements of non-imported items come from the game data too.
- Gem parameters: exact at the build's level (`statsPerLevel`), otherwise the site's ranges.
- The tree's `priorityList` is every notable/keystone taken, in selection order, not the author's pick.
- Support names without a game data record come from chips in the guide texts, otherwise from the slug.
- Checked on the live page: the `poe2-build-guide:parse` report matches the site's screenshots (variants, helmet,
  skills and supports).

### Step 3. Rich text (Lexical) → safe rendering ✅
`toRichBlocks` (`src/lib/rich-text/convert.ts`) → a typed tree; `<RichText>` (`src/ui/rich-text/`) renders it
through JSX only. Paragraphs, headings, lists (nested too), text format, `color: #hex`, line breaks,
links (http(s) only, relative → mobalytics.gg, `noopener noreferrer`), entity chips with an icon (`renderEntity` —
the extension point for tooltips). Unknown containers unwrap into a paragraph.
- UI CSS is passed inline (`?inline`) to `createShadowRootUi({ css })`: loading CSS the WXT way
  (`cssInjectionMode: 'ui'`) failed in dev with `Failed to fetch`. Design tokens — `src/ui/theme/tokens.css`.
- Dev modules with Preact/CSS are loaded only with `import()` inside `import.meta.env.DEV`, or they end up in production.
- Checked: the dev preview (`poe2-build-guide:preview`) on three builds matches the structure of the site's texts.

### Step 4. Mounting on the page ✅
The content script runs on all of `mobalytics.gg/*`, URL changes come from `wxt:locationchange`. The UI is mounted in
a shadow root on the first visit to a build (`src/ui/app/mount.tsx`).
- `createBuildLoader` (`src/lib/page/`): the build the page opened with comes from the current document, others are
  fetched as HTML; the game data is read once and cached (on failure, retried on the next load).
- `createPageController`: inactive / loading / ready / error + an `extension | original` mode; stale loads are
  dropped, a query/hash change on the same build doesn't reload. The mode is kept in `storage.local` (`pageModeItem`).
- The overlay covers the page (`position: fixed`, page scrolling locked); in original mode — an "Open guide" button.
- Checked in Chrome: the overlay, "Original" ↔ "Open guide", the mode after a reload, moving from the list to a build
  inside the SPA, Back/Forward, the error on a build that doesn't exist.
- Changing `permissions` in the manifest needs a manual extension reload in `chrome://extensions`.

### Step 5. Design tokens, header, tabs ✅
- Tokens — `src/ui/theme/tokens.css`; Inter (latin + cyrillic) is bundled and registered with the FontFace API as
  `PoE2 Guide Inter`: the site's CSP (`font-src *`) doesn't allow `data:`, and a FontFace from memory loads nothing.
- Header after the concept (`BuildHeader`): class art, name, class / ascendancy, patch, build types, author, the start
  of Build Overview, an "Original" button. Tabs (`Tabs`, lucide-preact icons): WAI-ARIA, arrows, keys `1`–`6`
  (listened for in the capture phase: WXT's shadow root stops key events from bubbling).
- Route in the hash: **`#gear_act-1`** (`src/lib/ui/route.ts`), no history entries (`replaceState`), outside hash
  changes are picked up. No slash: on load the site does `querySelector('#toc-item-' + hash + '-id')` and crashes on an
  invalid selector (checked: `#a/b` → "Oops, something went wrong").
- Tab panels — a placeholder for now, "This section comes in a later version".
- Follow-ups from feedback: the header collapses into a compact row (a chevron button, `aria-expanded`, the
  `headerCollapsed` setting in `storage.local`, shared by tabs, kept across builds); UI scrollbars —
  `::-webkit-scrollbar` in the palette (the standard `scrollbar-color` leaves arrows on Windows).

### Step 6. Tooltips ✅
- `build.entities`: chips from the guide texts, resolved through the game data (gem / passive / rune / item); entities
  removed from the game stay a chip without a tooltip.
- `src/lib/tooltip/`: a `TooltipModel` from an item, gem, passive or rune (as in the game: class, properties,
  requirements, description, effects, quality bonuses, flavour, Corrupted, a "ranges" note); `placeTooltip` — below →
  above → right → left, within the screen.
- `src/ui/tooltip/`: one `TooltipProvider` per build view, `WithTooltip` — a 150 ms delay on hover, immediate on
  focus, Escape/blur/scroll close it, `aria-describedby`.
- Overview shows the guide texts with tooltips on chips for now (the rest is step 9).
- Checked in Chrome: the Contagion, Atziri's Disdain, Eternal Life and Tecrod's Gaze tooltips match the site's.

### Step 7. Gear tab ✅
- `VariantPicker` (variant chips, `aria-pressed`) on tabs that have a variant; the choice goes into the hash (`#gear_act-1`).
- `GearPanel` (`src/ui/gear/`): groups as in the character sheet (`groupSlots`: Armour, Weapons, Weapon Set 2,
  Jewellery, Flasks & Charms); a slot card — icon, slot, name in rarity colour, the first 2 mods, runes; the item's
  tooltip on the card. On the right — Gear Priority (number, icon, name, slot; tooltip from the equipped item) and the
  author's notes with tooltips on chips.
- Follow-ups from feedback: no group headings and no "Gear" heading — armour as large cards, the rest in a compact grid
  (`splitSlots`), the second set labelled "Weapon · Set 2"; everything including the priority fits on one screen
  (checked on a 1463×662 window). Runes in items have their own tooltips (nested `WithTooltip` via `pointerover`).
  The author's notes span the full width under the gear and priority. Gear icons without `loading="lazy"`.
- Second follow-up: no "Variant" label; Gear after the concept — an armour column + a 2-column grid of the rest,
  stretched to the priority's height; standard slots always (empty ones say "Empty"), the second set, a third ring and
  charms only when filled (`sheetSlots`). The header became purely informational: "Collapse/Expand header" and "Show
  original page" are icons in the tab row, a collapsed header is hidden entirely (the tab row keeps the name). Overview —
  two columns, like a book. The whole UI is in English.
- Resistance/ES summary — step 11.
- Checked in Chrome: slots and priority for FULL LIFE and ACT 1, a rare item's tooltip with real mods and runes,
  switching variants.

### Step 8. Skills tab ✅
- `SkillsPanel` (`src/ui/skills/`): an Active Skills card (attribute requirements, rows in 2 columns: icon, name, tags,
  supports in a ring of the attribute's colour with tooltips; selection — `aria-pressed`), on the right — the selected
  gem's details (tags, parameters, requirements, description, effects, quality, supports with names and tooltips),
  Author's Notes full width. The selection resets when the variant changes (`key` by variant).
- The site's zero parameters (`Cast Time 0.0` on Essence Drain) are hidden when parsing.
- Gem Priority (`priorityGems` → `variant.gemPriority`): the order to get gems in, tied to their skill; a card under
  Active Skills, one-line entries in 4 columns, entries of the selected skill highlighted, tooltips on gems.
- Checked in Chrome: Lich FULL LIFE (supports match the site), Gemling Uber Endgame (exact parameters at level 19),
  selecting a skill, support tooltips; everything on one screen with the header expanded.

### Step 9. Overview tab ✅
- Left: the guide texts in two columns, like a book.
- Right — At a Glance from the fullest variant (`showcaseVariant`: the most items and skills, on a tie the later one):
  Strengths / Weaknesses (+ and − markers; after feedback — inside the card, not as separate blocks), the main skill,
  key unique items, ascendancy nodes (all with tooltips), author, update date, a video link (http(s) only, host label
  YouTube/Twitch).
- Checked in Chrome: Lich (ENDGAME LOW LIFE) and Pathfinder (Endgame). The first version, with cards stretched to At a
  Glance's height, left empty space — rebuilt into two columns.

### Step 10. Passives tab ✅
- The site's tree (a WebGL canvas with its own zoom buttons) stays in the site's DOM, but its block is laid
  `position: fixed` over our area (`lib/passives/tree-embed.ts`); the node can't be moved — the site's React would
  remount it.
- Findings: the anchor is `span[id$="-passive-tree-N"]`, N being the variant index; on a variant change the site
  remounts the section (a MutationObserver finds the new tree); the variant is switched by clicking the site's
  `[role=tab]`, the site rewrites the URL and loses our hash — we restore it. The canvas is created lazily when the
  section is visible — we scroll to it (under the overlay). An ancestor with `container-type: inline-size` made fixed
  positioning relative — lifted for the time being. The block has `min-height: 580px` — reset. The site's Tippy
  tooltips (z 9999) are raised by a style; our tooltips render outside `.overlay` (a portal) to sit above the tree.
  Until hydration the site ignores clicks/scrolling — we retry every second until the tree appears.
- Key Passives side panel: ascendancy, numbered key passives (icon, first effect, tooltip), points.
- Everything is restored on leaving the tab / going to the original (styles, container-type, scroll). The author's
  notes on the tree — in Notes (step 12).
- Not done from interface.md: highlighting/centring a node on a click in the panel (the site's canvas has no API).

### Step 11. Atlas Tree tab ✅
In place of resistances/ES (moved to "Future features"). The tab comes after Passives, only if some variant has an atlas.
- Data: `buildVariants.values[].atlasTree` — `mainTree` and sub-trees (`expeditionTree`, `bossTree`, …) with
  `selectedSlugs`; nodes resolve through the same `poe2PassiveSkillsGraph` graph (the second tree). Panel: points +
  notables/keystones per sub-tree. The boss tree's nodes are missing from the current static data — simply skipped.
  Variants have no atlas notes.
- Site: the `-atlas-tree-N` section exists only for variants with an atlas — the variant is switched through the tabs
  of any of the variant's sections. The height is set by an inner block (`min-height: 644px`) — the slot is looked up
  down to the first block with a min-height and not re-chosen afterwards.
- The site's trees load lazily when their section scrolls into view: retries alternate scrolling up and back.
- Checked: Lich (both endgames, ACT 1 — the empty state, going Atlas → Passives), Pathfinder without the tab.

### Step 12. Progression, tree notes, no Notes ✅
The user's decisions: the Notes tab was dropped (every guide text is already on Overview), passive tree notes go in the
Passives tab, quest rewards in Progression.
- Progression: the list of stages (variants in guide order) · the selected stage (the author's description + changes
  from the previous one: skills/supports, gear by slot, points and new key passives, "Open …" links) · Quest Rewards
  (`data.questRewards.quests[]`, only those with a chosen reward, by act in order of first appearance, "Choice" when
  there are several rewards).
- Passives: a "Key Passives / Author's Notes" switch in the side panel's heading, when the variant has notes.
- Stage order is the author's (Pathfinder has "Endgame" first — the comparison is nominal then).
- Checked: Lich (endgame, ACT 2 with "No changes"), Pathfinder; ACT 2 notes with tooltips.

### Step 13. States and polish ✅
- Loading — a spinner; errors — clear texts (no guide / the site changed (code) / network) and "Try again" (`controller.retry()`).
- Empty: variant tabs on a build without variants; a quiet icon in the tab bar when the static data couldn't be read.
- The tab is remembered (`local:lastTab`): it opens when the address has no tab; changing the variant doesn't count.
- Focus: `guardFocus` brings Tab back from the hidden page into the guide (forward — to the first button, back — to the
  last); the embedded tree's block is marked `data-poe2-build-guide-tree` and reachable from the keyboard. Visible
  focus on links in texts.
- `prefers-reduced-motion`: turns off animations and transitions globally (the spinner included).
- Regression in Chrome: Warrior (Warbringer), Monk (Martial Artist), Druid (+Atlas), Huntress (Ritualist),
  Sorceress — all tabs with content, no errors; plus the Witch/Ranger/Mercenary fixtures. A build that doesn't
  exist — "This page has no build guide…".

### Step 14. Packaging ✅
- Name `poe2perfect` (manifest, package.json, the brand in the overlay), `version_name: 0.1.0 beta`.
- Icons 16/32/48/96/128 in `public/icon/` (a dark square, an orange "P2" underlined like the active tab).
- `npm run zip` → `.output/poe2perfect-0.1.0-chrome.zip` (manifest: only `storage`, a content script on mobalytics.gg).
- README (install, development) and a guide for beta testers `docs/beta-guide.html` (published as an artifact).

### Changes after the beta (from feedback)
- Passives and Atlas Tree: if the variant has author's notes, the side panel opens on "Notes", key nodes in the second tab.
  Atlas notes — `descriptionPoe2AtlasTree` from the variant's atlas widget.
- Progression: the stage description goes under the Skills / Gear / Passives blocks.
- Gear: skills an item grants ("Grants Skill: …" in the base's `baseItemType.bakedDescriptions` and in unique mods,
  with the level "Level (1-20)") — a row with the gem's icon and tooltip on the card and a "Grants Skill" section in
  the item tooltip; the gem is looked up by name, the weapon-granted version (`weapongranted…`) first.
- Signed in: for a signed-in user the site renders the page in the browser, `__PRELOADED_STATE__` is almost empty →
  "no build guide". Now the build page is requested without cookies (`credentials: 'omit'`) when the current document
  has no build, and on navigation inside the site. Checked in Chrome signed in: opening a build, SPA navigation,
  Gear/Passives/Progression.
- Progression: the Skills / Gear / Passives blocks share one height (the tallest), the stage description is in an
  "Author's Notes" block.
- Overview: texts in a grid of two, cards in a row share their height, an odd last one takes the full width; the text
  column and At a Glance stretch to each other. At a Glance collapses into a narrow rail (`local:glanceCollapsed`).

### Release 1.0.0
- Version 1.0.0 (no `version_name`), archive `.output/poe2perfect-1.0.0-chrome.zip`.
- `store/`: 1280×800 screenshots (Overview, Gear with a tooltip, Skills, Passives, Progression), 440×280 and 1400×560
  promo tiles, a 128 store icon (96 art + 16 margins), listing texts and Privacy practices answers (`listing.md`),
  instructions in `PUBLISHING.md`. Source frames — `store/raw/`. The `store/` folder and the image scripts stay out of
  the public repository (only `PRIVACY.md` in the root).

### Voluntary donations
- Boosty (`boosty.to/resenpai`): a link in the README, `.github/FUNDING.yml`, the tester guide and the store
  description. Nothing is locked behind payment (a Chrome Web Store requirement and the spirit of the GPL). The page's
  texts and images — `store/boosty-page.md`, `scripts/make-boosty-assets.py`. Paying with foreign cards on Boosty is
  limited — add Ko-fi if needed.

### Passive priority (after 1.0.0)
- The Passives side panel is the levelling order: its sub-tab is called "Priority" and opens first, "Notes" second.
  The ascendancy is a priority too — its nodes are numbered. Atlas Tree has the same tab order.
- The node the tree starts from (`passive-…start`) is free: it no longer counts toward ascendancy and atlas points
  (`isFreeStartNode` in `parse-passives.ts`).

### Highlighting a node from the priority (after 1.0.0)
- Next to the tree the site has a "Notable Priority": each icon carries a `data-priority-slug` attribute with the same
  node slug as ours. Hovering such an icon draws a ring around the node on the canvas — checked on the live page.
- `lib/passives/tree-focus.ts` sends that icon the same events: hovering our Priority row highlights the node, a click
  is passed to their element. The search stays within the right tree's section, so passives and atlas don't mix up.
- Zooming the camera on a click couldn't be reproduced on the site (neither with a real nor a synthetic click) —
  perhaps a click only pins the highlight.

### Highlighting a gem from Gem Priority (after 1.0.0)
- Hovering (and focusing) a Gem Priority entry highlights the gem in Active Skills: the socket in its skill's row, and
  for a skill entry, the row itself. The match is by the "gem + parent skill" pair, so the same support in different
  skills isn't highlighted all at once.

### Open source (GPLv3)
- `LICENSE` (GPL-3.0-or-later), `NOTICE` (third-party components, a note on the name and logo), `CONTRIBUTING.md`
  (DCO), the licence in `package.json`.
- Fixtures are scrubbed on export (`lib/dev/scrub.ts`): guide texts → placeholder words, comments and other people's
  builds removed.
- Store images and `store/raw/` aren't tracked by git; they are rebuilt by `scripts/make-store-assets.py` and `make-icons.py`.

### Gear tab: belt, charms, Trade (after 1.0.0)
- The belt moved to the left column with the armour (five large cards), charms are always shown — empty ones as
  placeholders, so the grid doesn't jump between variants.
- Every equipped item has a **Trade** button — an icon in the bottom-left corner of the item tile (as on the site),
  always visible; the link `pathofexile.com/trade2/search/<league>?q=<query>` is built from
  `poe2TradeRequest` in the item's data — the same query the site itself opens (compared on the live page:
  13 of 14 links match, the fourteenth is the second set's weapon, for which the site draws no link).

### Cold start: 403 from the site's protection (after 1.1.0)
- User report: a freshly installed extension showed "Couldn't show this build" with a 403 on the first visit,
  and the build only loaded on the fifth try.
- Cause: the site is behind bot protection, which rejects requests from a browser it hasn't seen enough of yet.
  On a warmed-up profile the same request returns 200 even with `cf-cache-status: MISS`, so it isn't the cache.
- `createHtmlFetcher` makes up to four attempts with a growing pause (0.7 / 1.4 / 2.8 s) and sends the last one
  with `credentials: 'include'` — with the visitor's own session, with which the page already passed the protection.
- While retries run, the loading banner says "The site is slow to answer. Attempt N of M…" rather than looking stuck.
- If every attempt hit a 403, the error text suggests opening the original page and trying again.

### Copying gem names and remembering the variant (after 1.1.0)
- Clicking a gem in Active Skills, Gem Priority and the skill description copies its name (`lib/ui/clipboard.ts`:
  the clipboard API, with a hidden field and `execCommand` as a fallback). A "Copied …" toast stays for 2 seconds.
- Clicking an active skill's row both selects it and copies the name — it's one and the same gesture.
- The selected variant (act/stage) is remembered by build slug in `local:lastVariants`, for at most 30 builds.
- The top tab is remembered the same way, per build (`local:lastTabs`): it used to be shared, and a new build opened
  on someone else's tab. A build not read yet opens on Overview. The shared helper is `rememberPerBuild`.
- A build's author may rework the variants, so both the id and the title are kept: look up by id first, then by
  title, otherwise open the default variant. A variant in the address always wins over the remembered one.

### Item implicits and long names in Gem Priority (after 1.1.0)
- An implicit (the base's own mod: a ring's resistance, an amulet's spirit, a charm's condition) lives in
  `baseItemType.bakedDescriptions` of the static data. The site prints the line as is, class labels included:
  "Armour: Wand or Staff: Martial Weapon: All: +(10-15) to Intelligence" — checked against its own tooltip.
- We strip the labels. Their set is closed, checked across all the site's static data (1157 lines, 861 with a colon,
  609 of them "Grants Skill"): All, Armour, Body Armour, Boots, Bow, Gloves, Helmet, Martial Weapon, One Hand Mace,
  Quarterstaff, Sceptre, Shield, Spear, Wand or Staff. "Grants Skill" lines don't go into implicits — they are shown
  as a block of their own.
- In the tooltip the implicit stands above the rolls. It needs no rule of its own: each tooltip block already has a
  top one, and a second gave a double divider.
- In Gem Priority a long skill name used to spill into the next column: the row is now clipped
  (`overflow: hidden` on the row, `flex: 1; min-width: 0` down the chain). The skill name shrinks first:
  it has `flex-shrink: 1000` and `min-width: 3em`, so the gem name is only cut once three letters of the skill are
  left. The first version, with a 60% cap on the gem name, cut names even with a short skill beside them.

### Broken images from the site's CDN (after 1.2.0)
- Later it turned out the failures come in bursts and don't last: in Chrome, opening the page, 51 images of 134
  got a 503, and a minute later the same files were served (in parallel and one by one, 30 of 30). In Firefox at the
  same moment everything loaded, with the same IP, Cloudflare node and http/3 — the difference is in how the browsers
  spread requests over time, not in the network.
- Retrying (0.9 and 2.5 s with jitter) was tried and dropped: the change was reverted at the author's request, the
  placeholder should appear at once. The measurements are kept in case we come back to it: on Progression 18 of 53
  images failed at first, and a retry brought all of them back.
- What remains of that work: a failure the browser already holds in its cache arrives before the `onError` handler is
  attached. So `Icon` also asks for `decode()` — without it such images stayed broken, with no placeholder.
- Report: some items lost their icons. Checked by response codes: `cdn.mobalytics.gg` returns 503 for some files in
  `assets/poe-2/images/game/` (rings, an amulet, a staff, a flask, a belt) and 200 for others (helmet, body armour,
  skill icons). The site's own page had 36 broken images of 151 at that moment, i.e. an outage on their side.
- `ui/common/Icon.tsx` — the shared image component: on a load error (or with no link at all) a placeholder of the
  same size stays, and for decorations (header art, the tooltip icon, a chip in text) — nothing.
- The placeholder isn't blank but fits its place: armour, weapon, shield, jewellery, flask, charm, gem, passive, rune
  (`IconKind`). For gear the kind comes from the slot — `slotIconKind` in `lib/ui/slots.ts`.
- Every `<img>` in the interface goes through it, so the layout doesn't jump and no broken image icon appears.

### Exporting the build to Excel — removed (01.10.2026)
Built and removed at the author's request: "I don't see yet how to make it useful, maybe we'll come back later". The
code lives in history — `src/lib/export/*`, `src/lib/stats/parse-modifier.ts`, `src/ui/build/ExportButton.tsx`; the
last commit with it is found with `git log --diff-filter=D -- src/lib/export`. If we come back to it, it should come
with totals computed inside the interface, not as a separate file.

The original idea:
A community joke: "every PoE 2 build lives in a spreadsheet". We make a button that saves the build as an .xlsx
workbook — Excel opens it and Google Sheets imports it.

- Step 1. `lib/export/zip.ts` — our own ZIP without compression (the store method) with CRC32. No dependencies.
- Step 2. `lib/export/xlsx.ts` — a workbook of sheets: `[Content_Types].xml`, `.rels`, `workbook.xml`, sheets with
  inline strings, minimal styles (bold header, column widths).
- Step 3. `lib/export/build-sheets.ts` — the build as rows: Overview, Skills, Gear, Passives, Progression.
  The build variant is a column of its own, so filters and pivot tables work in the sheet.
- Step 4. A button in the tab bar (`ui/build/ExportButton.tsx`): builds the workbook and hands over `<slug>.xlsx`
  through a link with `download`. The name comes from the build's address, or from its title if the address has none.
  The browser itself reports success, and on failure a short `role="alert"` appears in the bar.
- Checked with a real file: a workbook from a fixture is read by openpyxl in strict mode (without a single warning),
  multi-line cells come with wrapping, a number stays a number, Cyrillic is intact.
- Step 5. The calculations it was all for: `lib/stats/parse-modifier.ts` takes the number and the stat name out of a
  line of game text ("+16% to Fire Resistance" → Fire Resistance, flat, 16). On a real build 84% of lines with numbers
  map to a named stat, the rest keep their wording with `#` in place of the number.
- A Stats sheet — a row per mod: variant, slot, item, stat, kind (flat/increased/more), value, min, max and the
  source line. A Totals sheet — a row per stat of each variant, sums through `SUMIFS` over the Stats sheet plus the
  estimate `Flat × (1 + Increased%) × (1 + More%)`. The sheet does the math, not the extension: edits recalculate.
- Roll ranges count at their mean, the bounds stay in the Min and Max columns. Overview has three explanatory lines.

### Firefox port (in progress)
After the neighbouring project `poe2perfect-trade`.

- Step 1 ✅. One manifest for both browsers: `lib/build/manifest.ts` (+ tests). Firefox gets a permanent id
  `poe2perfect@resenpai.dev`, `strict_min_version: 140.0` and the `data_collection_permissions: none` declaration.
  The AMO version is digits only (`firefoxVersion`), MV3 in both browsers, commands `dev:firefox`, `build:firefox`,
  `zip:firefox` (the last one also builds the sources zip for AMO review).
- Step 2 ✅. `lib/page/page-fetch.ts`: the build page is requested through `content.fetch` where it exists (Firefox),
  otherwise through the plain `fetch` (Chrome). Otherwise Firefox would request the page as the extension, from a
  foreign origin.
- Step 3 ✅. `lib/data/page-idb.ts` gives a list of databases: its own and the page's (`wrappedJSObject.indexedDB`),
  both tried in turn. In Chrome it's the same database, nothing changes.
- Step 3a ✅ (found by a live check in Firefox: "Loading build…" forever). Every outside wait is now time-limited:
  reading IndexedDB (`ATTEMPT_MS`, 2 s per attempt) and requesting the page (`attemptMs`, 15 s). Before, a hung call
  kept the loop from reaching the timeout check, and loading never finished.
- Step 4. A live check in Firefox: the passive tree (embedding someone else's canvas), the clipboard.
- Step 5. Documentation and material for addons.mozilla.org.

## Automated releases — done (01.10.2026)

Brought over from `poe2perfect-trade`: three workflows in `.github/workflows/` and `scripts/release-notes.mjs`.
- `ci.yml` — on a push to `main`/`dev` and on pull requests: tests, typecheck, both builds, the AMO linter (`web-ext lint`).
- `release.yml` — on a `v*` tag: checks the tag against the version in `package.json`, builds the archives, publishes
  a GitHub release with the changelog section as its notes, submits to the stores (behind the
  `PUBLISH_CHROME`/`PUBLISH_FIREFOX` switches).
- `store-check.yml` — manual: checks store access with `--dry-run`, sending nothing.
- Checked locally: `web-ext lint` gives 0 errors (one `innerHTML` warning from WXT's own code), and with version
  `1.3.0-beta.1` the archives are named after the package version while the Firefox manifest holds `1.2.999.1` —
  exactly what the workflow expects.
- Left to do by hand: add the repository variables and secrets (store keys) and do the first publication in each
  store yourself.
- `sign-xpi.yml` (manual) — signs the package unlisted while the listed version is in AMO review: that one is signed
  only after review, an unlisted one at once, and a version number is unique per add-on, so the code goes under a
  fourth number (`FIREFOX_BUILD=1` → `1.3.0.1`) and the `.xpi` is attached to that version's release.

## Comments (plan, 06.10.2026)

Spec: [reference/poe2perfect_comments_design.md](../reference/poe2perfect_comments_design.md), sketches —
`reference/Комментарии к билду …-2.png` (the tab) and `reference/Снаряжение и комментарии …-1.png` (Gear + panel);
these three files are local, not in the repository.
One data model, two views: the Comments tab (first) and a side panel (later). Replying right from the extension
(step C5a), Open on Mobalytics stays.

### Data (live check, 8 catalogue builds)
- **Seed in the document.** The `NgfDocumentCmWidgetCommentsV1` widget is in `doc.content[]` (not in `data.widgets`).
  `data.isDisabled`, `data.payload`: `resourceId`, `commentId` (empty), `error`, `page { hasMoreItems, nextCursor }`,
  `data { parentId: null, sortBy: "NEW", limit: 10, comments[] }`; `data.commentsUiCapabilities`:
  `loadingBehaviour: "SHOW_MORE"`, `sorting { enabled, defaultSortingOption: "NEW" }`. The same payload is in the
  state query `["ngf-comments", resourceId, "NEW", null]`. Signed-out HTML (our `credentials: 'omit'`) carries the
  seed; a signed-in user's state is empty (~500 bytes).
- **`resourceId` = `"Poe2:UG:" + doc.id`.**
- **The site's counter:** `doc.comments.stats.totalComments` (the site shows it in the guide's header). It counts
  messages of every level; the exact meaning with deleted ones doesn't add up (sample: 30 for 26 + 3 published). We
  show it as the site does.
- **What a page holds.** 10 roots + all their first-level replies: on all 8 builds the roots' `replyCount` sum equals
  the number of `depth: 1` that came. Replies to replies (`depth: 2`) aren't in the list.
- **A message:** `id`, `parentId`, `depth`, `accountId`, `content` (Lexical `{ root }`), `plainTextContent`,
  `status` (`PUBLISHED` / `DELETED`), `createdAt`, `updatedAt` (moves with votes — not an edit date), `deletedAt`,
  `deletedByModerator`, `isSpoiler`, `spoilerLabel`, `score`/`upvotes`/`downvotes`, `replyCount`,
  `profile { user { id, username, displayName }, avatar { iconUrl }, avatarFrame, title, commentator }`.
  Deleted: `status: DELETED`, empty text, `profile: null`, `accountId: ""` — a tombstone, replies under it live on.
  Regular users' `avatar` is often `null` → initials.
- **Body:** nodes `paragraph`, `text` (with `format`), `linebreak`, `autolink` — all already understood by our
  `toRichBlocks` (links through `safeHref`) → rendered with `<RichText>`, `plainTextContent` as a fallback.
- **The build's author:** `doc.author.id` (in the preloaded state and the fixtures) = `author.user.id` from GraphQL =
  the `accountId` of their comments — checked on two builds with author replies (7 and 4 matches). Not by name.
- **API** (`POST /api/poe-2/v1/graphql/query`, answers 200 without a cookie; the server prints input schemas in
  validation errors):
  - `NgfCommentsQuery` → `comments.comments(input: CommentsListInput { resourceId!, sortBy!, limit!, cursor })`;
  - `NgfCommentRepliesQuery` → `comments.replies(input: CommentsRepliesInput { parentId!, sortBy!, limit!, cursor })` —
    loads replies at any depth (checked for `depth: 2`) and the rest of long threads;
  - `CommentsSortBy`: `NEW`, `OLD`, `TOP` (other values are a schema error);
  - the answer is a `CommentsPayload` (like the seed), `error { code, message, retryAfterSeconds }`;
  - writing: `NgfCreateCommentMutation(CommentsCreateCommentInput { resourceId!, content: Map!, sourceUrl })` and
    `NgfCreateReplyMutation(CommentsCreateReplyInput { parentId!, content: Map!, sourceUrl })`, answering with the
    comment + `rejectionReason`; the site sends them with `Authorization: Bearer` (`getToken`). There are also Delete
    and Vote — not taken.
- **The `#comments` anchor.** The site's catalogue links to `/poe-2/builds/<slug>#comments` — for us it opens the
  Comments tab, which is what we want. Community builds (`/poe-2/profile/…`) aren't served by the extension — out of scope.
- **Site protection.** Frequent cookie-less HTML requests start getting 403 (GraphQL kept answering) — we don't
  re-request the page for comments, the seed comes from the document already loaded.
- **Not checked:** a build with `isDisabled: true` and a build without comments (none found in the catalogue) — parsed
  defensively, tests on synthetic data; the request from the content script (Chrome — plain `fetch`, Firefox —
  `content.fetch`) is checked live in C3.

### Steps
- **C1. Research and synthetic fixtures ✅** — the findings above. `tests/fixtures/comments.ts`: messages,
  a tombstone, a payload, the widget, `withComments(doc)`, GraphQL answers; `tests/comments-fixtures.test.ts` checks
  that `scrubBuildDocument` removes them and that they don't change how the build parses.
- **C2. Model and seed parsing ✅** (`lib/comments/model.ts`, `parse-comments.ts`). `parseCommentsSeed(doc)`:
  no widget / an empty or failed payload → `unavailable` (not zero), `isDisabled` → `disabled`, otherwise `ready`
  with `resourceId`, `sort`, `canSort`, `total` and the list. `parseCommentsPayload(payload, authorId)` also fits API
  pages (C3): roots in the site's order, replies per parent oldest first, duplicates by id collapsed, tombstones,
  spoilers with a label, the author by `doc.author.id`, avatars https only, junk records skipped.
  `LoadResult` carries `comments` next to `build`. **No "edited":** `updatedAt` moves with votes
  (on all 58 voted of 247 comments), and the site has no edit marker.
- **C3. Source and controller ✅** (`lib/comments/source.ts`, `controller.ts`). Source: `NgfCommentsQuery` and
  `NgfCommentRepliesQuery` through `pageFetch` (same-origin), errors reduced to `{ message, retryAfterSeconds }`
  (`HTTP 429` + Retry-After, the site's code, `network error`, `unexpected answer`), cancelling — AbortError. A
  controller per build: the first page from the document, `loadMore`, `loadReplies` (replies oldest first, the second
  level too), `setSort` (the list only changes when the new page arrives, pages in the old order are dropped), `retry`
  for `unavailable` (the first page through the API), `dispose`; one request per kind, no retries before `retryAt`.
  An `unavailable` seed now carries `resourceId`/`authorId`/`total`. Live check in Chrome (the dev hook
  `poe2-build-guide:comments`): sample build — 10 → 18 roots, a second-level reply loaded; a build with author
  replies — 14 of their messages recognised. Firefox — check by hand.
- **C4. Comments tab ✅** (`ui/comments/`: `CommentsPanel`, `CommentThread`, `CommentCard`, `use-comments`,
  `comments.css`; `lib/comments/time.ts`). The tab is last, always visible, doesn't reset the variant, the site's
  `#comments` opens it; the tab shows the site's counter. `PageController` creates a comments controller for each
  loaded build and closes it on leaving. Cards after sketch -2: avatar / initials, name, Build author, "2 hours ago"
  (the full date in title), the body through `<RichText>` (comments may hold item chips) with plain text as a
  fallback, folding after ~8 lines, spoilers behind a button. Deleted ones as on the site: hidden without replies,
  with replies — "This comment was deleted by its author." / "…removed by a moderator.". Threads open by themselves to
  the third level of replies (after the user's feedback), deeper — View N replies; a root can be folded (Hide
  replies). Missing replies of open threads load by themselves, beyond that — Load more replies; a reply to a reply —
  at the same indent with "Replying to @name" (a button to the parent); a thread gets Author replied. **Also here from
  C6:** Load more comments and page errors (with "The site asked to wait N s."). States: No comments yet, disabled,
  unavailable (+ Try again through the API), Loading comments…. Checked live: 10 → 20 roots, an author reply with the
  badge and line, second-level replies.
- **C5. Going to the site ✅** (`lib/page/original-comments.ts`). "Reply on Mobalytics" in the tab's footer (and with
  an empty list), "Open on Mobalytics" in the unavailable state; disabled — no buttons. Original mode in the same tab
  (ArrowUpRight), then `revealOriginalComments`: waits for `[data-testid="comment-widget-general"]` up to 5 s
  (MutationObserver), scrolls the window so the widget's top is 72 px from the edge (the site's sticky header is
  56 px), for Reply puts the caret in the site's field (`role=textbox`, only there when signed in) — writes and sends
  nothing. Open guide returns to Comments (the hash doesn't change). No `Open thread`: the comments' `data-id` in the
  site's DOM comes and goes between loads — there is no reliable thread anchor.
- **C5a. Comments and replies from the extension ✅.** Auth is the visitor's session cookie, not a token: in the
  browser the site's GraphQL client sends `Authorization` only in the desktop app (`IS_DESKTOP`), and the "Bearer" in
  the bundle is Firebase. Checked with a harmless mutation removing a vote from a comment that doesn't exist: without a
  cookie — `FORBIDDEN: not authenticated`, with one — `NOT_FOUND`. `content` — Lexical as the site's editor makes it
  (a paragraph per line, `textFormat`/`textStyle` on paragraph), taken from the user's test comment; `sourceUrl` — the
  build's address without the hash. `source.post` (`NgfCreateCommentMutation` / `NgfCreateReplyMutation`),
  `controller.post` (your own comment goes first, a reply at the end of its thread, counters +1; `FORBIDDEN` →
  signed-out, `rejectionReason` → rejected, the site's delay).
  UI: an "Add a comment" field, one line high, above the list; Reply on every live comment opens a field under it (one
  at a time, focused, Cancel / Escape), sending only by the button or Ctrl+Enter, a 1000-character limit, the text
  survives an error; signed out — "Sign in on Mobalytics to comment." with a way to the site. The footer button is
  "Open on Mobalytics" (without focusing the site's field). Publishing live from the extension is checked by the user.
- **C6. Navigating the discussion ✅** (`lib/comments/filter.ts`, the panel). Infinite scroll (at the user's request)
  instead of Load more: an end-of-list marker + IntersectionObserver (root — the list, 400 px margin), the observer is
  recreated on every new page; on an error — no auto-retry, Try again. Sorting Newest / Oldest / Top (a select that
  shows the chosen one while loading, on an error — "Couldn't sort the comments"), hidden when `canSort: false`.
  Search over loaded texts and names (`filterThreads`): threads with matches, the path to a matching reply opens over a
  folded one, highlighting through the CSS Custom Highlight API (`::highlight()` in the shadow root's styles, the text
  is left alone). All comments / Author replied chips (`aria-pressed`), hidden without `canIdentifyAuthor`. While
  searching/filtering it doesn't load by itself: "Searching loaded comments only (N of M). Load more", empty — "No
  matches in loaded comments". While search or the filter is on, missing replies load for every loaded thread down to
  the auto-open depth (otherwise an author reply deeper than the first level in a hidden thread wasn't found). Checked
  live; in a background automation tab the observer stays silent while the browser draws no frames
  (`visibilityState: hidden`) — in a normal tab it works.
- **A feed instead of cards (after user feedback: "read it like a thread feed", like Reddit) ✅.** The bar is one row
  of ~40 px with no heading (the name and count are on the tab): chips, search 200→260 px on focus, sorting as text
  (Newest / Oldest / Top), an Open on Mobalytics icon; the bar and the input field are the first items of the
  scrolling list and scroll away with the feed; no footer — the list takes the full height.
  A column up to 960 px; comments without borders, threads parted by a thin rule, avatars 28 / 24 px, "name · time" in
  one line, grey 12 px actions (accent only for the author and recovery buttons), replies hang off a line from the
  avatar's centre. Comment text and the input field use the reading font Noto Sans 15/23 px (`--font-reading`,
  `@fontsource-variable/noto-sans`, latin + cyrillic, registered like Inter through FontFace, +~75 KB in base64), the
  interface — Inter. Sketches -1/-2 are no longer the reference for this part.
- **Reddit-style threads ✅.** Replies are truly nested ("Replying to" dropped): a line runs down from the avatar, a
  rounded "elbow" leads to each reply, the line ends at the last reply. Folding — a − circle on the line (Hide
  replies) or a click on the line itself; each open thread has its own. A folded thread, as on the site: a "View N
  replies" row under the actions with a + circle on the line (the text serves as the button for screen readers).
  Sorting — our own menu (`SortMenu`, listbox: arrows, Enter/Space, Escape, click outside) instead of a native select,
  whose dropdown was drawn in the system style.
- **Votes ✅** (at the user's request; the spec had deferred them). `score` and `viewerVote` in the model,
  `NgfCommentVoteMutation { commentId, value: UPVOTE | DOWNVOTE }` and `NgfCommentDeleteVoteMutation { commentId }`
  (the schema from a validation error, the values from the bundle, checked on a comment that doesn't exist). In the
  actions row ▲ score ▼; the controller gets the arrow pressed, and "set or remove" is decided by the actual vote.
  The first page is read without a cookie and doesn't know the reader's votes (the cause of the "+2 on removal" bug),
  so before the first vote on one of its comments it is re-read once through the API with the session (`viewerVote`;
  the mutation's answer lacks that field). A vote shows at once only when the reader is known to be signed in (the
  site already took their vote/comment or returned their vote); otherwise after the answer, so a "Sign in on
  Mobalytics to vote." refusal doesn't flash a +1. The line's tail at the last reply is gone (covered from the start of
  the curve), "elbows" 1.5 px.
- **Thinner thread lines with highlighting ✅.** 1 px, the "elbow" exactly on the parent's line; hovering the line or
  circle highlights it and the "elbows" to direct replies (`:has()`, the `--rail` variable on the comment and
  `--branch` on the replies block).
- **C7. Side panel ✅.** An icon button on the right of the tab bar: on every section with a window ≥ 1180 px wide —
  Open / Close comments panel (`aria-expanded`, highlighted when open); on a narrow window — Open comments: the
  Comments tab with a "Back to <section>" button. The panel is an `aside`
  on the right, `clamp(360px, 32vw, 480px)`, with its own scrolling, a "Comments N" header + Expand + Close; the same
  feed, state (search, filter, folded threads, reply, sorting) lifted into `useCommentsUi` and shared by the panel and
  the tab. Sections give up their right column through an explicit `besideComments`: Gear hides Priority, Skills puts
  the skill description under the list, Overview drops At a Glance (the saved state is left alone), Passives / Atlas
  Tree — the order and notes column (the site's embedded tree follows its area through a ResizeObserver),
  Progression — Quest Rewards. Expand → the tab with "Back to …", Back returns to the section with the panel open;
  Close and Escape (unless a nested control handled it) close it, focus goes to the button; the window narrowing with
  the panel open → the tab with Back. The panel doesn't change the hash and isn't remembered across reloads.
- **Portraits instead of empty avatars ✅** (`lib/comments/portraits.ts`). 30 portraits from the site's CDN:
  8 classes (`classes/icon/<class>.jpg`) and 22 ascendancies (`ascendancies/icon/poe-2-<slug>.jpg`, the list from the
  game data's `poe2Ascendancies`); only the addresses are in the code. A portrait is picked by FNV-1a of the account
  id — a person always gets the same one; their own avatar comes first; if it fails to load — the next one, then
  initials. Avatars are rounded squares of 36 / 30 px from the same `--avatar` as the thread lines. A separate
  workflow (`portraits.yml`, `scripts/check-links.mjs`) checks weekly that all 30 links still answer with an image.
- **The panel as one of the section's cards ✅.** The panel has the cards' border, radius and surface; the variant
  chips got a card of their own, so both columns start level. With the panel open the whole view scrolls as one, with
  the scrollbar at the window's right: a grid row as tall as the taller column (`minmax(min-content, 1fr)`), and the
  comments card runs down beside the section however long it is, its feed laid over the card so a long discussion
  never stretches the page. The embedded trees follow scrolling of any container around them (capture-phase listener
  on the shadow root).
- **C8. Check and release ✅ (except manual checks).** Live in Chrome: moving between builds inside the SPA while
  loading — the new build's feed and counter, the old one's page doesn't stick. Resizing the window with the tool
  didn't work (the window is maximised), the narrow window is covered by tests. Docs: CHANGELOG (Unreleased →
  Comments), README (the Comments tab, keys 1–7, privacy), PRIVACY.md (reading the feed with the session, posting
  only on a press). By hand: Firefox (feed, reply, vote, the panel next to the tree), 1280×720 / 1920×1080 / 125 %,
  keyboard (Tab through the feed, the sort menu, Escape), long threads. Before the release, decide whether
  `data_collection_permissions` in the Firefox manifest has to change: the extension now sends the user's text to
  mobalytics.gg when they press the button.

Simplifications against the spec (deliberate): no separate capabilities table beyond the flags actually found, no
Refresh and no restoring the reading anchor on a width change in the first version, nesting — two levels, as on the site.

## Future features

### Builds from player profiles (research 07.10.2026)
An outside PR #9 (juddisjudd) did this, but it went to `main` past `dev` and changed line endings — we do it ourselves,
starting from its findings, checked again live.

**Addresses.** `/poe-2/profile/<profile>/builds/<slug or id>`; the author's build list links each build by its slug,
or by its id when it has none (`slugifiedName: null`). `#comments` works there as on guides. PoE 1 pages
(`/poe/...`) stay out of scope.

**By slug** (e.g. a streamer's builds): the signed-out HTML carries the build, like a guide. State query
`["ngf-ug-normal-document-page", <slug>, <profile>, []]`, path `game.documents.userGeneratedDocumentBySlugifiedName.data`.
The document has exactly the guide's fields (`id`, `content`, `data`, `author`, `comments`…), and the comments seed sits
in the state as `["ngf-comments", "Poe2:UG:<id>", "NEW", null]`.

**By id:** no HTML holds the build, signed in or out (checked: the state is ~560 bytes, the id isn't in the page).
The site loads it after opening with `Poe2UgNormalDocumentByIdQuery` (`input: { id, widgetsOverride: [] }`) on
`/api/poe-2/v1/graphql/query`; the answer comes without a cookie too, at
`game.documents.userGeneratedDocumentById.data` — again the same document, `slugifiedName: null`, with the comments
widget (`resourceId` `Poe2:UG:<id>`, here a first page of 24 and a total of 30).
- The query is 38 KB of text with 68 typed fragments: a short query of our own can't ask for the document.
- The server takes only a full query string (`MISSING_QUERY_STRING` by operation name alone); it supports persisted
  queries, but the site doesn't register its own, so there is no hash to send.
- So there are two ways: catch the site's own answer from the page world (PR #9: a MAIN-world script at
  `document_start` wraps `fetch`, hands the answer over as an event, keeps the last 5), or send the site's query from
  the extension (a 38 KB copy that has to follow their schema).

**Build key.** A slug is unique only within its author, so remembered tabs and variants key profile builds as
`<profile>/<slug or id>`; guides keep their slug, so what readers have stored survives.

Steps (to agree on before starting):
- P1. URLs ✅. `getBuildRef` reads both forms (`guide` / `profile` with `slug` or `id`), `getBuildKey` gives the key;
  the page controller, loader and remembered tabs/variants run on the key (state field `key`, was `slug`).
  `isBuildPageUrl` still takes guides only, so profile pages stay untouched until the loader can read them.
- P2. Slug builds ✅. `extractBuildDocument` knows both state queries (`ngf-ug-featured-document-page` →
  `userGeneratedDocumentBySlug`, `ngf-ug-normal-document-page` → `userGeneratedDocumentBySlugifiedName`);
  `isBuildPageUrl` takes profile builds by slug. Found on the way: the embedded tree never showed for a build with a
  single variant (guides too), since the site draws no variant tabs then and the tree section was only recognised
  with them — tabs are now required only of the section used to switch variants. Checked live, signed in: a direct
  open (Overview, Gear, Passives with the tree), a move from the author's build list inside the SPA, Comments.
- P3. Id builds: get the document (the chosen way), with a time limit and a clear message if it never comes.
- P4. Comments, fixtures export and the dev hooks on profile builds; PRIVACY/README/CHANGELOG.
- P5. Live check: both forms, a guide as before, SPA moves between them, signed in and out; Firefox by hand.

### Resistances and ES (beta)
Computed from items (unique mods — the min–max range, rare mods from the build) and passives
(`bakedDescriptions`). Shown in the Gear summary marked **beta** with an "approximate" tooltip.
- Tests: parsing mod lines (`+(20-30)% to Fire Resistance`, `+X to maximum Energy Shield`, `% increased`),
  summing, unknown mods ignored.
- Check: compare with Path of Building / a calculator on one build (if the guide has a PoB code).
