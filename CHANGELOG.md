# Changelog

Chinese changelog: [CHANGELOG_ZH.md](CHANGELOG_ZH.md).

## v4.2

- Shortened English UI labels to fit the compact floating panel.
- Added hover titles for shortened English controls.
- Updated both English and Chinese userscript versions to 4.2.

## v4.1

- Renamed the project to `R34Video Watch Archive Downloader`.
- Updated the Chinese display name to `R34Video Watch Archive Download + Auto Batch Download`.
- Added separate English and Chinese userscript builds.
- Made the English userscript the primary build and removed all Chinese text from it.
- Updated README and CHANGELOG so English is the default documentation language.

## v4.0

- Added watched-video archiving behavior on top of batch collection and download workflows.
- Kept watched-page listeners for real navigation, AJAX pages, pseudo-navigation, and inline video signals.

## v3.8

- Improved pagination counting by reading page numbers from `href` and `data` attributes.
- Kept the v3.7 collected-page display behavior.
- Published as the canonical `r34video-bulk-downloader.user.js` at the time.

## v3.7

- Added advanced-panel page progress display as `Collected x/y pages`.
- Counted collected pages from successful page collection progress.

## v3.6

- Consolidated batch download, auto-download, auto-page collection, metadata save, YT-DLP export, parallel parsing, pseudo-page listeners, setting sync, loop collection, and download statistics.

## v3.5

- Added loop collection: return to the first page after the last page and stop when repeated items are detected.
- Updated top statistics to include submitted and downloaded counts.
- Unified panel button styling.

## v3.4

- Changed browser download order to save `.meta.json` before video.
- Added `GM_addValueChangeListener` for cross-tab settings sync.
- Split persisted queue state from synchronized settings.

## v3.3

- Added listeners for AJAX / pseudo-navigation video pages.
- Hooked click capture, DOM mutations, history changes, popstate, hashchange, pageshow, and URL polling.
- Added delayed watched-page checks to avoid duplicate queueing.

## v3.2

- Debounced persistent state writes.
- Added parallel parsing controls.
- Added automatic download for newly auto-queued watched videos.
- Cached UI nodes and reduced repeated page parsing.

## v3.1

- Initial expanded version with batch collection, auto paging, direct video parsing, browser download, direct-link export, YT-DLP command export, metadata JSON, and watched-video auto-queue.
