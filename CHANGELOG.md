# Changelog

## 1.4.0

### Builds from player profiles
- Builds published from a player's profile (`mobalytics.gg/poe-2/profile/<player>/builds/…`) now open in the guide
  too, with every tab and their comments, whether the address carries the build's name or its id. Thanks to Judd
  (juddisjudd) for working out how the site serves them.
- The passive and atlas trees now show for a build with a single variant; they stayed on "The site didn't show a
  passive tree" before.

### Comments
- A new Comments tab shows the build's discussion from the original page, read as a thread feed: answers nest under
  the comment they answer along a thread line, as on Reddit, and open by themselves three levels deep. A minus on the
  line folds a branch; a folded one says how many replies wait there. The build author is marked in words, deleted
  comments with answers stay as "[deleted]", spoilers wait behind a button, and long comments fold after a few lines.
- More comments load as you scroll. Search the loaded comments (matches are highlighted and their threads open),
  sort by newest, oldest or top, or keep only the threads the build author answered in.
- Write a comment, reply to any comment and vote, right from the guide, as your own Mobalytics account. Nothing is
  sent until you press the button; a signed-out visitor is pointed to signing in on the site.
- Read the comments beside any other tab: the comment icon in the tab bar opens them as a side panel, which takes the
  place of that tab's side column (gear priority, the passive order, the quest rewards…) for as long as it is open.
  On a narrow window, or from the panel's own button, they open as the Comments tab, with a way back.
- Comment text is set in Noto Sans, a calmer face for long reading; the rest of the guide keeps Inter.
- A commenter without an avatar gets the portrait of a class or ascendancy instead of a bare letter, picked from
  their account so it is always the same one for them.
- Beside the comments, the section's blocks and the comments panel line up as one set of cards: the variant chips
  have a card of their own, everything scrolls together with one scrollbar at the window's right, and the comments
  card runs down beside the section however long it is.

## 1.3.0

### Firefox
- poe2perfect is now a Firefox add-on as well, built from the same source as the Chrome extension: the same guide,
  the same tabs, the same preferences. Firefox 140 or newer.
- Loading a build could go on forever in Firefox, with the panel left on "Loading build…". The guide now gives the
  page's own storage and the site a limited time to answer, and falls back to reading the build from the page.

### Gear
- An item that grants many skills (one amulet grants seven) no longer stretches the whole gear grid: the card shows
  the first two and counts the rest, and the tooltip still lists them all.

### Pictures
- A picture the site does not give up — its CDN drops files now and then — leaves a stand-in shape instead of the
  browser's broken-image mark: armour, a weapon, a shield, jewellery, a flask, a charm, a gem, a passive or a rune,
  whichever belongs in that place. Names, modifiers and tooltips stay where they are.

### Also
- A new icon: a gothic medallion with the passive tree on it.

## 1.2.0

### Skills
- Clicking a gem — in Active Skills, in Gem Priority or in the skill details — copies its name, ready to paste
  into the game's own search. The panel says which name it took.
- A long skill name in Gem Priority ends in an ellipsis instead of reaching into the next column.

### Gear
- Item tooltips now show what the base item gives on its own — the resistance of a ring, the spirit of an amulet,
  the condition of a charm — above the rolled modifiers, as the game does. It was missing on every item that has one.

### Where a build opens
- A build opens again on the tab and at the act or stage you last read it at, remembered for each build on its own.
  A build you open for the first time starts on Overview, whatever you were reading elsewhere.
- When the author renames or rebuilds a variant, the guide finds the stage again by its name and otherwise opens
  the author's default. A link that names a tab or variant still wins, so shared links open what they point at.

### Loading
- A first visit to mobalytics.gg could fail with an HTTP 403: the site's bot protection turns away a browser it
  has not seen before. The guide now waits and asks again a few times, spends its last attempt on the visitor's
  own session, and says on screen that it is still trying instead of showing an error straight away.

## 1.1.0

### Passives and Atlas Tree
- The side panel is now called **Priority** and opens first: it shows the order in which to take the passives.
- Ascendancy passives are numbered in the order to take them.
- Point counts for the ascendancy and the atlas no longer include the free starting node, so they match the game.
- Hovering a passive in the Priority list highlights it on the tree; clicking it centres the tree on that node.

### Skills
- Hovering a gem in **Gem Priority** highlights it in **Active Skills**, so you can see which skill it belongs to.

### Gear
- The belt now sits in the left column with the helmet, body armour, gloves and boots.
- All three charm slots are always shown; empty ones appear as placeholders, so the layout stays the same across
  build variants.
- Every equipped item has a **trade** icon (scales) in the corner of its picture: it opens the official Path of
  Exile trade site with a search for that item.

### Overview
- A collapsed **At a Glance** panel now expands when you click anywhere on it.

## 1.0.0

First public release: a clean tabbed view of PoE 2 build guides on mobalytics.gg — Overview, Skills, Gear, Passives,
Atlas Tree and Progression.
