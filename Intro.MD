
# R34 Video Watch Archive Downloader

![R34 Video Watch Archive Downloader](https://raw.githubusercontent.com/GitRuozhi/Video-Watch-Archive-Downloader/master/Intro01_EN.png)

Lightweight plugin. Supports bulk video downloads from rule34video.com and rule34gen.com, and automatically queues watched videos. It can save descriptions, tags, and other metadata. Supports browser downloads, link export, and YT-DLP command export.
 
## Introduction : 

- Supports video downloads from rule34video.com and rule34gen.com.

- Watched videos automatically enter the queue.

- Maintains 2 language versions, English and Chinese.

- Supports search page, uploader page, user page, favorite page, and other list page collection.

- Supports rule34video pseudo-navigation AJAX subpages.

- Supports 4 download methods: browser direct download, link export, IDM EF2 import, and YT-DLP command export.

- By default, the panel appears in the lower right corner of the window. It can be collapsed to a small button and dragged with the mouse.

- Shows download progress while downloading.

- Click [Current] to add all videos shown on the current page to the queue.

- Click [Pages] to automatically turn pages and add videos from multiple pages to the queue.

- Click [Start] to download with the selected method. When using [Browser] download mode, the browser's own downloader may not show progress immediately and may only show completion after the file finishes.

- Click [Again] to reset failed items and start downloading again.

- Supports advanced options.

- For IDM, import the saved `.ef2` using Tasks → Import → From IDM export file. Each video keeps its Referer and browser User-Agent.

- Signed links may expire if unused for a long time; EF2 does not include login cookies.

- When enabled, Meta saves video metadata as JSON before downloading. Export modes also save metadata as JSONL. Available metadata can include the title, description, tags, uploader, upload date, thumbnail, and file information.
 
Github: https://github.com/GitRuozhi/Video-Watch-Archive-Downloader/
 
## Update log : 

V5.1 :

- Fixed IDM-related issues: export EF2 with per-video Referer and User-Agent, keep the final CRLF, and refresh old R34 links before export. Failed refreshes retain the page for retry without exporting stale links.

- Officially released Iwara Video Watch Archive Downloader.

- Added support for rule34gen.com.

V4.8 :

- Added the initial URL\tReferer TXT export for IDM, replaced by EF2 in v5.1.

V4.7 :

- Hardened security validation.

- Added the initial Iwara version.

V4.6 :

- Refactored the download flow and added manual retry for failed tasks.

- Added download progress display.

- Improved log output.

V4.4 : Release version
