# Security policy

## Supported versions

Only the latest release (in the Chrome Web Store, on Firefox Add-ons and on the
[Releases](https://github.com/ReSenpai/poe2perfect/releases) page) gets security fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/ReSenpai/poe2perfect/security/advisories/new)
with what you found, how to reproduce it and what it could affect.

You can usually expect a first answer within a week. Once a fix is released, the advisory is published with credit to you,
unless you prefer otherwise.

Things of particular interest: anything that could let a build page — its guide text, an item name or a comment — run
code in the extension, send the visitor's mobalytics.gg session or stored preferences anywhere but mobalytics.gg,
or reach data beyond the build page and the site's own game-data cache.
