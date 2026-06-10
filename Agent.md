# Agent Notes

This repository maintains a Tampermonkey userscript for `rule34video.com`.
It archives watched videos, collects videos from list pages, resolves direct
video URLs, and supports browser downloads plus link/YT-DLP exports.

## Files

- `r34-video-watch-archive-downloader.user.js`: primary English UI script.
- `r34-video-watch-archive-downloader.zh.user.js`: Chinese UI script.
- `README.md` / `README_ZH.md`: user-facing docs and release notes.
- `Introduction_R34 Video Watch Archive Downloader.txt`: SleazyFork release text.
- `It01_EN.png` / `It02_ZH.png`: release screenshots.

## Bilingual Maintenance

Keep the English and Chinese scripts functionally identical. When changing
logic, settings, storage, parsing, downloading, or limits, update both files.
Language differences should stay limited to userscript metadata and visible UI
text.

The English UI uses compact labels for the narrow floating panel. The Chinese
UI can use clearer full phrases where space allows. Do not mechanically copy
English short labels into the Chinese version.

## Difference Summary

| Area | English script | Chinese script |
| --- | --- | --- |
| File | `r34-video-watch-archive-downloader.user.js` | `r34-video-watch-archive-downloader.zh.user.js` |
| UI language | English, compact labels | Chinese, clearer labels |
| Metadata | English `@name` / `@description` | Chinese `@name` / `@description` |
| Behavior | Should match Chinese version | Should match English version |

`Agent.md` is for coding agents. Keep it concise and focused on maintenance
rules, not full user documentation.
