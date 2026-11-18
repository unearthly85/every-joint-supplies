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

## Placeholder icon

`scripts/placeholder-icon.py` draws `public/icon.png`, `public/icon.ico`, and `src/server/icon.png`. Replace those files when a real icon exists. No need to change the name config to do that.
