# Iwara Video Watch Archive Downloader

![R34 Video Watch Archive Downloader](https://raw.githubusercontent.com/GitRuozhi/Video-Watch-Archive-Downloader/master/Intro01_EN.png)

A lightweight userscript for bulk video downloads from `iwara.tv` and `iwara.ai`. It automatically queues watched videos and can save descriptions, tags, and other metadata. It supports browser downloads, link export, and YT-DLP command export.

## Introduction

- Supports video downloads from `iwara.tv` and `iwara.ai`.

- Automatically adds watched videos to the queue.

- Maintains English and Chinese versions.

- Collects videos from search, uploader, user, favorites, and other list pages.

- Supports four methods: browser download, link export, IDM EF2 import, and YT-DLP command export.

- The panel appears in the lower-right corner. It can be collapsed to a small button and dragged with the mouse.

- Shows download progress while downloading.

- Click [Current] to add all videos shown on the current page to the queue.

- Click [Pages] to automatically turn pages and add videos from multiple pages to the queue.

- Click [Start] to download using the selected method. In [Browser] download mode, the browser's downloader may not show progress immediately and may show completion only after the download finishes.

- Click [Again] to reset failed items and start downloading again.

- Supports advanced options.

- For IDM, import the saved `.ef2` file using **Tasks → Import → From IDM export file**. Each video keeps its Referer and browser User-Agent.

- Signed links may expire if unused for a long time; EF2 does not include login cookies.

- When enabled, Meta saves Iwara metadata as JSON before downloading. Export modes also save metadata as JSONL. Available metadata can include the title, description, tags, uploader, upload date, thumbnail, and file information.

GitHub: [Video-Watch-Archive-Downloader](https://github.com/GitRuozhi/Video-Watch-Archive-Downloader/)

## Update log

V5.1:

- Fixed IDM-related issues: EF2 keeps each video's Referer and User-Agent and includes the final CRLF. R34 exports refresh old links before export; failed refreshes retain the page for retry without exporting stale links.

- Officially released Iwara Video Watch Archive Downloader.

- Added support for `iwara.ai`.
