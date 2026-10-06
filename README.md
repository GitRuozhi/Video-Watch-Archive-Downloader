# Video Watch Archive Downloader

[简体中文](README_ZH.md)

Two independent Tampermonkey userscript families are available. R34 supports `rule34video.com` and `rule34gen.com`. Iwara supports `iwara.tv` and `iwara.ai`. Both families are at version **5.1**, with English and Chinese scripts.

| Family | Supported sites | English | 中文 |
| --- | --- | --- | --- |
| R34 | `rule34video.com`, `rule34gen.com` | [Install](https://sleazyfork.org/zh-CN/scripts/581996-r34-video-watch-archive-downloader) | [安装](https://sleazyfork.org/zh-CN/scripts/581999-r34-video-watch-archive-downloader-zh) |
| Iwara | `iwara.tv`, `iwara.ai` | [Install](https://sleazyfork.org/zh-CN/scripts/599005-iwara-video-watch-archive-downloader) | [安装](https://sleazyfork.org/zh-CN/scripts/599006-iwara-video-watch-archive-downloader-zh) |

Read the [R34 introduction](Intro.MD) or [中文介绍](Intro_ZH.MD), and the [Iwara introduction](Intro_Iwara.MD) or [中文介绍](Intro_Iwara_ZH.MD) for details.

## Install

Install the Tampermonkey browser extension, then choose the English or Chinese script for the sites you use from the table above. Install one language version per family; use both families if you use both R34 and Iwara.

## Features

Both families can automatically queue watched videos, collect videos from the current or multiple list pages, and download with the browser or export links, IDM EF2 files, YT-DLP commands, and metadata JSONL. The floating panel supports retrying failed tasks and shows queue and download progress.

Quality choices differ by family:

- R34: Best, 8K, 4K, 1080p, 720p, 480p, and 360p.
- Iwara: Best, Source, 540, 360, and preview.

## Use

Install the script for the site and language you want. On a supported site, use **Current** to collect the videos shown on the page or **Pages** to collect multiple pages. Choose a download mode and click **Start**. Use **Again** to retry failed tasks; **Init** clears the queue and counters without changing settings.

## IDM EF2

Choose **IDM** mode and click **Start** to save an `.ef2` file. In IDM, select **Tasks → Import → From IDM export file**. Each video record includes its page Referer and browser User-Agent. EF2 does not include browser login cookies. Signed video links can expire, so import the file promptly. R34 refreshes old or unresolved links before export and omits links whose refresh fails.

## Version 5.1

- Fixed IDM EF2 records to preserve Referer and User-Agent and include the final CRLF.
- Added `rule34gen.com` support to the R34 scripts and `iwara.ai` support to the Iwara scripts.
- Released the Iwara English and Chinese scripts.

## Tests

Run the regression tests with `node --test tests/idm-export.test.cjs tests/r34-export-refresh.test.cjs`.

## Source files

- R34: [English](r34-video-watch-archive-downloader.user.js) / [中文](r34-video-watch-archive-downloader.zh.user.js)
- Iwara: [English](iwara-video-watch-archive-downloader.user.js) / [中文](iwara-video-watch-archive-downloader.zh.user.js)

## Screenshots

| R34 | Iwara |
| --- | --- |
| ![R34 downloader panel](https://raw.githubusercontent.com/GitRuozhi/Video-Watch-Archive-Downloader/master/Intro01_EN.png) | ![Iwara downloader panel](https://raw.githubusercontent.com/GitRuozhi/Video-Watch-Archive-Downloader/master/Intro_Iwara01.png) |

Sensitive media, titles, account avatars, and video links in the Iwara screenshots are blurred. The Iwara screenshots show the Chinese script panel.

GitHub: [Video-Watch-Archive-Downloader](https://github.com/GitRuozhi/Video-Watch-Archive-Downloader/)
