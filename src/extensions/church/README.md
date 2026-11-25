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

`importer/save.ts` turns a reviewed draft into a library song: `findSameTitle` looks up an existing song with the same name (case-insensitive, trimmed) and `buildLibraryShow` builds the FreeShow show for a draft with the arrangement the reviewer left, under a fresh id.

`importer/bulk.ts` reads the picked files for the songs-found list (P0-08 s5): a PDF goes through the text guard first and then the pasted-text parser, everything else goes through `parseFile` (an OpenLyrics XML may yield several songs), and a file that yields nothing becomes one failed row with a plain reason. One file failing never stops the rest. It also builds the plain-language report line after an import. Pure TypeScript, no stores, no UI.

`importer/SongImport.svelte` is the review screen in the New Sunday panel: the volunteer pastes or drops the lyrics, checks the detected parts and labels, and saves the song to the library — or, when a song with the same name already exists, saves it as a new song or replaces the saved one in place. Several files at once (file picker or drag-and-drop) fill a songs-found list instead: one row per song with a check box, a plain status, and an Open button that loads the song into the same preview-and-fix view (saving it returns to the list with the song marked done). "Import selected" saves the checked songs, skips same-title songs instead of overwriting them, and reports what was imported, skipped, and failed. A single text, Markdown, or PDF file keeps the one-song flow.

## Hymns

`hymns/types.ts` is the shape of a verified hymn: its text, where it was taken from, and the plain reason it is public domain (published in the US by 1930 or earlier, so public domain as of 1 Jan 2026). `hymns/validate.ts` checks a record and a whole catalog against that shape, so a title without a full record — source, public domain reason, every stanza — cannot be loaded. `hymns/catalog.ts` loads the bundled catalog (throwing if any record fails validation) and finds a hymn by id or title. `hymns/draft.ts` turns a hymn into the importer's draft, so a hymn is loadable as a library show or service item. `hymns/bundle/` holds the bundled hymns, one file each; the starter set is the twelve public domain hymns listed in [HYMNS.md](hymns/HYMNS.md), each with a source line and a plain public domain reason. Pure TypeScript, no stores, no UI.

`hymns/search.ts` adds hymn title search for the "Add a hymn" box: `normalizeTitle` strips case, punctuation, and parentheses from a typed name, `titlesOf` lists a hymn's title, aliases, and first line, `matchTitle` returns the single best match for a Hymnbase-style lookup (exact id, title, or alias, then a unique starts-with hit, then a unique contains hit; a tie returns null rather than a guess), and `searchHymns` returns the ranked, deduplicated list for type-ahead. Pure TypeScript, no stores, no UI.

The "Add a hymn" box on the Sunday song panel (`SundayOrder.svelte`) is the volunteer-facing end of that: type a hymn name, pick a bundled hymn from the results, and it is saved to the song library (reused when a song with the same name already exists) and applied to this Sunday's song through the same replace-and-confirm flow as choosing a saved song.

## Encryption

`crypto/` holds the church encryption pieces. The library is `libsodium-wrappers-sumo` 0.8.4: XChaCha20-Poly1305 envelopes with a version and a key id (`envelope.ts`), and Argon2id for passphrases (a later step). Keys are never logged, printed, or put into error messages.

`crypto/keyslot.ts` is the key slot: a 32-byte key encrypted under a key that Argon2id (never weaker than the interactive cost) derives from a secret — a passphrase or a recovery code, NFKC-normalized — and a fresh 16-byte salt, sealed in an envelope under the label `ejs:keyslot:<kind>`; a wrong secret gives one fixed `WrongSecretError` that never names the secret. The slot format is generic, so Phase 1 reuses it for the per-person PIN backup.

`crypto/recovery.ts` makes and normalizes the recovery code a volunteer writes down: 15 random bytes (120 bits) as 24 Crockford base32 characters (no I, L, O, U) in 6 groups of 4, and `normalizeRecoveryCode` accepts the code typed with lowercase, spaces, O for 0, or I/L for 1.

`crypto/orgKey.ts` is the church (org) key file (P0-10 e3): one 32-byte key per church, wrapped in two slots — under the volunteer's passphrase (at least 8 characters) and under the written-down recovery code — with the key id in the file, so a slot swapped in from another church's file can never unlock it; `changePassphrase` and `newRecoverySlot` re-wrap the key without touching the other slot. Pure TypeScript, no UI, no disk I/O; the per-person key of Phase 1 will sit beside it, not inside it.

## Stage display

`stage/layout.ts` builds the default stage layout (current words, part label, next words and item, clock, notes, and a stage message) and reads or sets the notes, chords, and message switches on it.

`stage/screen.ts` works out which screens are free for the stage screen, so the stage can never take over the program output (the HDMI going to the ATEM).

## Program output

`program/preset.ts` is the preset for the clean full-screen program output (the HDMI going to the ATEM Mini) and works out which screens are free for it, so the program can never take over the booth or the stage screen. `program/apply.ts` puts the program on the chosen screen with one click, and `ProgramScreen.svelte` is the panel section that offers it. `program/audio.ts` chooses which output device the program audio (the countdown and the songs) plays through: the system default (the ATEM's embedded HDMI audio) or a specific device such as the PA system.

`keyable/preset.ts` is the preset for the keyable lower-thirds output: the slide at its normal position on a solid key colour (green screen or black), so a keyer can cut everything but the text out. `keyable/apply.ts` turns that preset on and off from one switch in the program screen section: it makes sure the keyable style exists, puts the keyable output on the first free screen, and removes the output when the switch is off.

## Placeholder icon

`scripts/placeholder-icon.py` draws `public/icon.png`, `public/icon.ico`, and `src/server/icon.png`. Replace those files when a real icon exists. No need to change the name config to do that.
