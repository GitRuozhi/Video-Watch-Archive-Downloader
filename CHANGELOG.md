# Changelog

## v3.8

- Improved pagination counting by reading page numbers from `href` and `data` attributes.
- Kept the v3.7 collected-page display behavior.
- Current canonical release used for `r34video-bulk-downloader.user.js`.

## v3.7

- Added advanced-panel page progress display as `已采集 x/y 页`.
- Counted collected pages from successful page collection progress.

## v3.6

- Consolidated batch download, auto-download, auto-page collection, metadata save, YT-DLP export, parallel parsing, pseudo-page listeners, setting sync, loop collection, and download statistics.

## v3.5

- Added loop collection behavior: return to the first page after the last page and stop when repeated items are detected.
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
