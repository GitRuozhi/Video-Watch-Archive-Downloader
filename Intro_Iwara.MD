# Iwara Video Watch Archive Downloader

## Description

A lightweight userscript for collecting and downloading videos from Iwara. It can gather videos from the current list page or across multiple pages, automatically queue watched videos, and export links or download commands.

## Introduction

- Supports Iwara pages on `www.iwara.tv` and `iwara.tv`, including Iwara API and file-source lookup.

- Collects video links from the current page or from multiple list pages. Multi-page collection follows the site's page navigation and stops when it reaches the configured page limit or detects wrapped duplicates.

- Can automatically add a watched video to the queue. Optional Auto DL starts downloading or exporting with the selected mode after a video is queued.

- Supports four methods: Browser download, Links TXT, IDM EF2, and YT-DLP command export.

- Iwara's available quality names include Source, 540, 360, and preview. Best prefers Source, then 540, 360, and preview; if a selected quality is unavailable, the script uses the best available source.

- The Meta option saves an Iwara metadata JSON file before its video download. Export modes can also save collected metadata as a JSONL file. Metadata can include the title, description, tags, uploader, upload date, thumbnail, and file details when available.

- Videos that only provide an external embed cannot be downloaded directly by the script; an Iwara media source must be available.

- The panel appears in the lower-right corner. It can be collapsed to a small button and dragged with the mouse. The advanced options include Auto queue, Auto DL, Meta, request Threads, the page limit, download Mode, Quality, and filename components.

- Click **Current** to collect videos from the page currently shown. Click **Pages** to follow page navigation and collect multiple list pages. Click **Start** to download or export using the selected mode. Click **Again** to retry failed downloads, and **Init** to clear the queue and counters without changing settings.

- Browser mode uses the browser's download manager. Depending on the browser, progress may appear only after a download finishes.

- For IDM, select IDM mode and import the saved `.ef2` file in IDM using **Tasks → Import → From IDM export file**. Each media record includes its Iwara page Referer and browser User-Agent. Import signed links promptly; EF2 does not include login cookies.

- English and Chinese script versions are available.

GitHub: [Video-Watch-Archive-Downloader](https://github.com/GitRuozhi/Video-Watch-Archive-Downloader/)

## Update log

V5.1:

- Fixed IDM-related issues.
- Official release of Iwara Video Watch Archive Downloader.
