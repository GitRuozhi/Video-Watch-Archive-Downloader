# R34 Video Watch Archive Downloader

Tampermonkey userscript for archiving watched videos and batch downloading videos from `rule34video.com`. Iwara Video Watch Archive Downloader is officially released alongside the R34 version. See the [Iwara introduction](Intro_Iwara.MD) for its features and usage.

Current source version: **v5.1** for both R34 and Iwara.

Chinese documentation: [README_ZH.md](README_ZH.md).

## Install

Install from SleazyFork:

- English: https://sleazyfork.org/scripts/581996-r34-video-watch-archive-downloader
- Chinese: https://sleazyfork.org/scripts/581999-r34-video-watch-archive-downloader-zh

Open the project page and click install. This GitHub repository keeps the source code and release assets for development and review.

To test this checkout, replace the matching script's code in the Tampermonkey editor with its `.user.js` file, save, and reload the site tab. Source changes may be newer than the published build; update the existing script to keep its stored queue.

## Features

- English and Chinese UI scripts with matching behavior.
- Automatically queue watched videos from real pages, AJAX pages, and pseudo-navigation.
- Collect videos from search, uploader, user, favorites, and other list pages.
- Resolve direct video URLs and available quality variants.
- Choose quality: best, 8K, 4K, 1080p, 720p, 480p, or 360p.
- Browser download mode can optionally save metadata JSON before submitting the video download.
- Export direct-link TXT, YT-DLP command TXT, IDM EF2 with per-video Referer and User-Agent, and metadata JSONL.
- Configure filename parts: ID, title, and original filename.
- Floating panel with Queue, Active, Success, and Failed statistics.

## Import into IDM

1. Update the userscript, collect videos, and wait for their links to resolve.
2. Open advanced options, select **IDM** as the download mode, and click **Start**. For R34, wait for the link refresh to finish and the new export files to appear.
3. In IDM, choose **Tasks → Import → From IDM export file** and select the saved `r34video-idm-*.ef2` or `iwara-idm-*.ef2` file.

Use the **IDM export file** importer, rather than **From text file**. Each EF2 record contains one media URL with its referring page and browser User-Agent as separate fields. The old v4.8 TXT placed two URLs on each line; IDM's text importer scans all URLs and can add the referring HTML pages as downloads instead of preserving Referer. Regenerate those old files with the updated script.

The **Links TXT** mode still exports bare URLs without request headers. Import signed video links promptly: expired links must be resolved and exported again. EF2 does not export browser login cookies; if a server still returns HTML, check its login requirements and IDM browser integration.

R34 refreshes queued links before export when their resolution time is unknown or at least ten minutes old. This is a local refresh policy, not the server's token lifetime. Failed refreshes retain the page in the queue for retry and omit its stale media URL from the export. Updating the script preserves the existing queue; export a new file instead of reusing an older EF2/TXT.

If the site requires your existing system proxy, select **Downloads → Options → Proxy / Socks → Use system settings** in IDM and restart the queue. Browser access can work while IDM's direct connection stalls.

IDM's [text import documentation](https://www.internetdownloadmanager.com/support/import_downloads.html) describes URL scanning. The EF2 record format is also illustrated in the [ef2 project's documentation](https://github.com/MotooriKashin/ef2#readme); this script uses only the standard Referer and User-Agent fields.

## Source Files

- `r34-video-watch-archive-downloader.user.js`: English userscript.
- `r34-video-watch-archive-downloader.zh.user.js`: Chinese userscript.
- `iwara-video-watch-archive-downloader.user.js`: English Iwara userscript.
- `iwara-video-watch-archive-downloader.zh.user.js`: Chinese Iwara userscript.
- `Intro.MD` / `Intro_ZH.MD`: SleazyFork release introduction text.
- `Intro_Iwara.MD` / `Intro_Iwara_ZH.MD`: English and Chinese Iwara release introductions.
- `Intro01_EN.png` / `Intro02_ZH.png`: release screenshots.
- `Agent.md`: short maintenance notes for coding agents.

## Validation

Run the dependency-free regression suite with `node --test tests/idm-export.test.cjs tests/r34-export-refresh.test.cjs`. The refresh tests exercise both R34 languages using fictional pages and mock GM requests, including legacy caches, mixed failures, current-page refresh, retry, and concurrent clicks. For a local HTTP fixture, run `node tests/manual/idm-test-server.cjs`; it prints the EF2 paths and a manifest under `.git/idm-verification`. It serves only on `127.0.0.1` and returns media only when both Referer and User-Agent match. Pass `--media-file path/to/sample.mp4` to use a playable sample, or `--self-test` to check HTTP and Range handling without IDM.

The optional browser check is `node tests/manual/r34-export-browser.cjs`, with Playwright installed or its module path passed as the first argument. On 2026-10-07, isolated headless Edge contexts ran each complete R34 userscript with local HTML pages and a GM API shim: clicking the actual panel refreshed five old links, exported all six records, and recovered from six failed refreshes through the Again button. EF2 and JSONL were captured as real browser downloads. This covers browser UI behavior with synthetic requests, not a live Tampermonkey extension or the R34 site.

Native import was verified with IDM **6.43.12** on 2026-10-06: all four scripts imported and downloaded eight protected sample videos with matching SHA256 hashes. The old TXT produced sixteen candidates, including eight HTML pages, and lost the exported request headers. Native testing also found that the closing line needs a final CRLF; without it, IDM omitted the last record. The regression suite now requires that terminator, including for single-video exports. These checks cover the import format and request headers, rather than a live site's login or expiring links.

A separate Iwara transfer check on 2026-10-06 ran the repository's parser and export functions in a Node VM for two public, general-rated videos. IDM downloaded both Source MP4 files (1440p/60fps and 1080p/60fps, about 430 MiB total), and both passed full video/audio decoding with FFmpeg. IDM needed the existing system proxy. This check did not exercise the Tampermonkey browser panel, authenticated/private videos, expired links, or live Rule34Video downloads.

## Release Notes

### v5.1

- Fixed IDM-related issues: export EF2 with per-video Referer and User-Agent, include the final CRLF so every record imports, and refresh old R34 links before export while retaining failed pages for retry.
- Officially released **Iwara Video Watch Archive Downloader** in English and Chinese, with dedicated introduction documents. Both site scripts now use version 5.1.

### v4.8

- Added the initial IDM export mode using URL\tReferer TXT. This format did not associate the Referer reliably and was replaced in v5.1.

### v4.7

- Hardened security validation.
- Added the initial Iwara version.
- Aligned the Iwara metadata `scriptVersion` value with the userscript release version.

### v4.6

- Refactored the download flow and added manual retry for failed tasks.
- Added live download progress display.
- Improved log output.

### v4.5

- Retried video downloads reuse already saved metadata JSON instead of saving duplicate metadata files.
- Unified watched-video auto download with the normal queue downloader.
- Completed downloads are removed from the queue immediately while failed items stay in the queue.
- Added retry-count logs for automatic retries and an Again button for retrying failed queue items.
- Changed the top counters to Queue, Active, Success, and Failed.
- Renamed Clear to Init; initialization clears the queue and counters without changing settings.
- Added a lightweight progress box below the action buttons from `GM_download.onprogress` with percent, compact size, speed, and ETA.
- Renamed the running download action to Stop send to clarify that active browser downloads are not cancelled.
- Restored active downloads after a page reload are marked as final failures to avoid automatic duplicate submissions.
- Added a download-round summary log with success and failed counts.
- Updated both English and Chinese userscripts to 4.5.

### v4.4

- Added a default-on metadata download checkbox in advanced options.
- Allowed browser download mode to skip metadata JSON and download only the video.
- Counted video-only downloads as complete when the video finishes.
- Updated both English and Chinese userscripts to 4.4.

### v4.3

- Improved compact English collection labels.
- Limited the max-pages input to 64 in both userscripts.
- Removed unused helpers, dead auto-download wiring, and redundant persisted parse statistics.
- Replaced `Agent.md` with concise maintenance notes for coding agents.
