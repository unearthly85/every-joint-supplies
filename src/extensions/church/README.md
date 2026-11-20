# Church extension

This folder is ours. Upstream FreeShow code stays where it is. New worship-presentation behavior (Sunday templates, section handoff, church-node sync, and anything else we add) goes here, behind the thinnest possible hooks in upstream files. Those hooks are listed in [UPSTREAM.md](../../../UPSTREAM.md).

## Product name

[product.json](product.json) is the only place the product name, app id, installer file name, GitHub repository, and fork feature flags are defined. A later rename is an edit to that file, then `node scripts/preBuild.js` so the window-title tags (marked `data-ejs-product`) are rewritten from it.

`features.ts` re-exports that file for the Svelte app. The Electron main process reads the same JSON through `src/electron/utils/productConfig.ts`. The Windows installer reads it from `config/building/electron-builder.fork.cjs`.

## What is turned off

- `features.churchAppsCloudSync` is `false`. The app does not upload shows to ChurchApps / B1. The connect buttons are hidden, and the sync calls return before any request is made.
- `features.upstreamDonatePrompt` and `features.upstreamAnalytics` are `false`, so we do not send volunteers to ChurchApps fundraising or FreeShow's analytics property.
- Auto-update *publish* is off. The app is wired to check this repository's GitHub Releases, and nothing is uploaded until that is turned on (see UPSTREAM.md and SIGNING.md).

## Sunday service

`service/model.ts` is the service, section, and item model. It is stored as a FreeShow project and shows (sections in the project list, song parts as slide groups, the arrangement as the layout). `SundayPanel.svelte` is the booth screen for starting a Faith Covenant Sunday. `App.svelte` mounts that panel. That mount is the core hook, listed in [UPSTREAM.md](../../../UPSTREAM.md). The timer that plays the countdown is a later task. This module only stores the times.

## Importer

`importer/labels.ts` is the detection core of the assisted lyric importer (P0-08): it decides which pasted lines are section labels (VERSE 1, Chorus, V, {Custom}, [Verse]) and which are credits (CCLI, author, copyright, public domain), and it proposes a title. Pure text in, text out; the preview UI is a later step.

`importer/draft.ts` builds on that: it turns a pasted text into a reviewable draft (title, parts, credits) and builds the FreeShow library show from it — parts as slides, the default arrangement as the layout. Pure TypeScript, no stores, no UI.

`importer/formats.ts` adds the bulk file-format parsers on top of the same draft model: OpenLyrics XML (one or more `<SONG>` blocks), ChordPro (`{c:}` markers, `start_of_`/`end_of_` pairs, `%` metadata, inline chords stripped), and CCLI SongSelect downloads (`.usr` in the layout OpenLP's CCLI importer documents, `.txt`/`.md` through the pasted-text parser). `parseFile` picks the parser from the file name. Pure TypeScript, no stores, no UI.

`importer/pdf.ts` extracts the selectable text from a PDF with the `pdfjs-dist` legacy build (the same worker the upstream PDF preview uses) and decides whether the result has enough words to be worth importing; when a PDF is image-only it points the volunteer at copying the text from Proclaim instead.

## Stage display

`stage/layout.ts` builds the default stage layout (current words, part label, next words and item, clock, notes, and a stage message) and reads or sets the notes, chords, and message switches on it.

`stage/screen.ts` works out which screens are free for the stage screen, so the stage can never take over the program output (the HDMI going to the ATEM).

## Program output

`program/preset.ts` is the preset for the clean full-screen program output (the HDMI going to the ATEM Mini) and works out which screens are free for it, so the program can never take over the booth or the stage screen. `program/apply.ts` puts the program on the chosen screen with one click, and `ProgramScreen.svelte` is the panel section that offers it. `program/audio.ts` chooses which output device the program audio (the countdown and the songs) plays through: the system default (the ATEM's embedded HDMI audio) or a specific device such as the PA system.

`keyable/preset.ts` is the preset for the keyable lower-thirds output: the slide at its normal position on a solid key colour (green screen or black), so a keyer can cut everything but the text out. `keyable/apply.ts` turns that preset on and off from one switch in the program screen section: it makes sure the keyable style exists, puts the keyable output on the first free screen, and removes the output when the switch is off.

## Placeholder icon

`scripts/placeholder-icon.py` draws `public/icon.png`, `public/icon.ico`, and `src/server/icon.png`. Replace those files when a real icon exists. No need to change the name config to do that.
