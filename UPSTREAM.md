# Tracking upstream FreeShow

This is a developer note. Church volunteers do not need it. They install the Windows installer and open the app.

This repository is a **soft fork** of [ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow) (GPL-3.0). We keep their Electron/Svelte app and add a thin layer under `src/extensions/church/`. We do not rewrite the presenter. If a merge here is painful, the patch was too deep.

## Exact revision this fork started from

| | |
|---|---|
| Upstream | https://github.com/ChurchApps/FreeShow |
| Branch | `main` |
| Commit | `c8ec93aee774b27b5e74c63346296581efed1bdd` |
| Subject | macadam fix |
| Date | 2026-11-13 13:53:03 +0100 |

That commit is the root of this repository's `main`. Later merges move us forward; record the new upstream SHA at the bottom of this file when you merge.

## Upstream remote

Git remotes live in each clone, not in the GitHub repository. Add it once:

```bash
git remote add upstream https://github.com/ChurchApps/FreeShow.git
git fetch upstream
```

`origin` is this fork (`unearthly85/every-joint-supplies`). Never push to `upstream`.

## When to merge

Merge `upstream/main` on every FreeShow release, and at least every few weeks when they have not tagged one. Do it before adding a large feature, so conflicts stay small.

Prefer **merge** over rebase once other people are building this branch. A merge commit keeps our history and their history both intact. Rebase only a private branch that nobody else has checked out.

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

To try the same thing on a feature branch:

```bash
git fetch upstream
git merge upstream/main
```

After a merge:

1. Resolve conflicts. Keep our `src/extensions/church/product.json` values. Re-apply the hooks in the list below if upstream rewrote those lines.
2. Run `npm test` at least `npm run test:unit`, and the Windows installer workflow.
3. Note the new upstream SHA in the log at the bottom of this file.

Do not merge our branch into ChurchApps/FreeShow. Generic fixes we want them to have should be offered as a separate pull request against their repository, under GPL-3.0.

## What is ours

These paths do not exist upstream. A merge should not touch them unless we are resolving a rename.

- `src/extensions/church/` — product name, feature flags, and future church-specific behavior
- `config/building/electron-builder.fork.cjs` — installer identity, our update feed, signing switch
- `.github/workflows/windows-installer.yml` — fast checks on every pull request; Windows NSIS build and smoke test only on main, nightly, manual dispatch, or the `full-ci` label. See [TESTING.md](TESTING.md).
- `scripts/ci/windows-installer-smoke.ps1` — silent install, launch, uninstall
- `UPSTREAM.md`, `SIGNING.md`, `TESTING.md`
- `public/icon.png`, `public/icon.ico`, `src/server/icon.png` — placeholder icons

`product.json` is the only place the product name, `appId`, installer file name, and GitHub owner/repo are written. Window titles marked `data-ejs-product` are filled from that file by `scripts/preBuild.js`.

## What we deliberately did not take from their release process

- **Their update feed.** `src/frontend/utils/checkForUpdates.ts` asks this repo's GitHub Releases, not `ChurchApps/FreeShow`. The installer embeds the same feed (`publish` in the fork electron-builder config). Nothing is uploaded: `npm run release` and CI pass `--publish never`. `npm run release:publish` is the switch for later (P0-02). `.github/workflows/release.yml` no longer runs on push to `main`.
- **Their Authenticode certificate.** `electron-builder.yaml` still contains Live Church Solutions Azure signing options. Our builds do not use that file directly. The fork config strips `azureSignOptions` unless our own signing secrets are set. See [SIGNING.md](SIGNING.md).
- **Their WinGet package.** `.github/workflows/winget.yml` no longer publishes `ChurchApps.FreeShow`.
- **ChurchApps / B1 cloud sync.** Disabled unless `features.churchAppsCloudSync` is `true` in `product.json`. The UI hides the connect button, and the main-process sync functions return before opening a connection.
- **Their donate prompt and analytics.** `features.upstreamDonatePrompt` and `features.upstreamAnalytics` are `false`. The analytics flag is checked at the start of `trackEvent`, so scripture usage does not reach measurement id `G-CEE6P1QXG6` either.
- **Sentry.** Upstream already refuses to start Sentry unless `public/release.json` says the build came from `ChurchApps/FreeShow` (`src/electron/IPC/responsesMain.ts`). `scripts/preBuild.js` writes `GITHUB_REPOSITORY` into that file. Our builds are not that repository, so crash reports are not sent to their project.

## Core-file hooks

These are the upstream files we edit, and why. New behavior should not add to this list if it can live under `src/extensions/church/` instead.

| File | Why |
|---|---|
| `package.json` | Description, author, and `repository` point at this fork. `release` / `release:local` use the fork builder config and `--publish never`. |
| `scripts/preBuild.js` | Copies `product.json` to `public/brand/product.json` and refreshes `data-ejs-product` titles. |
| `public/index.html`, `public/loading.html` | Window and splash titles. Loading screen reads `product.json` at runtime. |
| `src/server/stage/index.html`, `src/server/remote/index.html` | Stage and remote document titles. |
| `src/server/stage/App.svelte` | Stage screen uses our icon instead of the FreeShow mark. |
| `src/frontend/tsconfig.json` | Typecheck includes `src/extensions/church` so the UI can import it. |
| `src/frontend/main.ts` | Document title from `product.json`. |
| `src/frontend/utils/language.ts` | Replaces the word `FreeShow` in translation strings with our product name. |
| `src/frontend/components/main/Top.svelte`, `Splash.svelte`, `ProfileSelector.svelte` | Visible product name. |
| `src/frontend/App.svelte` | Mounts the New Sunday panel and the booth time bar, and starts the Sunday handoff watch. |
| `src/frontend/components/show/Projects.svelte` | A compact "Sunday" button on the project list and on an open project, plus a New Sunday row next to New project. |
| `src/frontend/components/inputs/ShowButton.svelte` | A Sunday item (`data.church`) shows the short label on the project entry. Every other project item still shows the stored show name. |
| `src/frontend/components/helpers/showActions.ts` | When a slide does not already advance on media end, a Sunday item with `on_media_end` uses that same action. |
| `src/frontend/components/helpers/OutputHelper.ts` | A manual advance clears the pending Sunday handoff before the clock can move again. |
| `src/frontend/components/main/popups/About.svelte` | Product name, GPL credit, and a "Based on FreeShow" link. |
| `src/frontend/components/main/Tipbar.svelte` | Does not send people to ChurchApps fundraising. |
| `src/frontend/utils/analytics.ts` | `trackEvent` returns immediately when analytics are off, including scripture usage. |
| `src/frontend/utils/checkForUpdates.ts`, `popups/NewUpdate.svelte`, `popups/UpdateManager.svelte` | Update check and download links use this repo. |
| `src/frontend/utils/startup.ts`, `cloudSync.ts` | No ChurchApps startup sync and no "connect cloud" prompt. |
| `src/frontend/components/settings/tabs/Files.svelte`, `Connection.svelte` | ChurchApps connect / sync controls are hidden. |
| `src/electron/utils/productConfig.ts` | **New file** in the Electron tree. Reads `product.json` for the main process. |
| `src/electron/index.ts` | `app.setName` and the window title come from `product.json`. |
| `src/electron/contentProviders/ContentProviderRegistry.ts` | Refuses ChurchApps connect and startup load while the flag is off. |
| `src/electron/cloud/syncManager.ts` | Refuses ChurchApps upload, merge, and restore while the flag is off. |
| `src/frontend/utils/createData.ts` | Default watermark text uses our product name. |
| `src/frontend/components/settings/tabs/Outputs.svelte` | Default NDI and OMT source names. |
| `src/frontend/components/drawer/live/recorder.ts` | Recording filenames use our prefix. |
| `.github/workflows/release.yml` | Manual only, and it cannot publish or use their certificate while it calls `npm run release`. |
| `.github/workflows/winget.yml` | Disabled so a release cannot update the FreeShow WinGet package. |
| `README.md` | This project's description and the FreeShow attribution. |

Icons (`public/icon.png`, `public/icon.ico`, `src/server/icon.png`) are replaced binaries, not logic hooks.

## Left on purpose

These still talk to upstream services. They do not upload a church's shows.

- Docs and help links still open `https://freeshow.app/docs`. That is their manual for the shared presenter.
- Scripture search can call `https://api.churchapps.org/content/bibles` for Bible text.
- YouTube embeds still send the referrer `https://freeshow.app/` because that is what the player expects.
- Google Drive sync (a user-supplied key) is unchanged. It is not ChurchApps cloud sync.
- File-format labels such as "FreeShow Song" stay, because that is the upstream file format.
- `public/icon.icns` is still the upstream Mac icon. Mac builds are not part of this task. Windows uses `public/icon.png` and `public/icon.ico`.

## TODO for later tasks

Not part of the Windows rebrand. Do not treat these as done.

- [ ] Replace `public/icon.icns` with our icon when Mac builds are scheduled. `public/icon.png` and `public/icon.ico` are already the placeholder.
- [ ] Decide what to do with help links that still open `https://freeshow.app` (docs, quick search, scripture help, companion, and the YouTube embed referrer in `src/electron/index.ts`). They document the shared presenter. A later task should either keep them as upstream docs or point operators at our own help.
- [ ] Decide what to do with ChurchApps Bible API usage (`https://api.churchapps.org/content/bibles` in `src/frontend/components/drawer/bible/scripture.ts`). It fetches Bible text. It is not cloud sync of shows. A later task should confirm we still want that source, or replace it.

## Merge log

| Date | Upstream SHA | Notes |
|---|---|---|
| 2026-11-17 | `c8ec93aee774b27b5e74c63346296581efed1bdd` | Fork created. Soft-fork rebrand and unsigned Windows CI. |
