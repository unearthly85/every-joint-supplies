<p align="center">
  <img src="public/icon.png" width="120" alt="Every Joint Supplies" />
</p>

<h1 align="center">Every Joint Supplies</h1>

<p align="center">
  Free, open-source worship presentation for churches: lyrics, scripture, slides, and stage display, with simple setup and no tech needed. Built on FreeShow. "Every joint supplies" (Eph 4:16).
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0-blue.svg?style=for-the-badge" /></a>
</p>

## Install on Windows

Download the NSIS installer from a **CI** workflow run that built it (a merge to `main`, the nightly run, or a pull request labeled `full-ci`). The artifact is named `EveryJointSupplies-windows-nsis`. Double-click it. The app opens to the main window. The build is unsigned until code signing is turned on, so Windows SmartScreen may warn before the certificate exists. That is expected for now. See [SIGNING.md](SIGNING.md) and [TESTING.md](TESTING.md).

A new install includes a welcome show. Open it and send it to a screen (or a window) from the output controls. No terminal and no account are required.

The product name, app id, and installer file name live in one file: [`src/extensions/church/product.json`](src/extensions/church/product.json). A later rename starts there.

## Based on FreeShow

Every Joint Supplies is a modified version of [FreeShow](https://github.com/ChurchApps/FreeShow) by Kristoffer Vassbø and [ChurchApps](https://churchapps.org/), licensed under the GNU General Public License v3.0 only. This is **not** FreeShow, and it does not connect to FreeShow's update feed or to ChurchApps cloud sync.

- License: [LICENSE](LICENSE) (GPL-3.0). Our changes are under the same license. We do not relicense this app.
- Corresponding source for the installers we build is this repository.
- Upstream project: https://github.com/ChurchApps/FreeShow
- How we merge their work: [UPSTREAM.md](UPSTREAM.md) (developers only).

FreeShow's own documentation at [freeshow.app/docs](https://freeshow.app/docs) still describes the shared presenter. Community support for unmodified FreeShow stays with that project.

## For developers

Churches do not do this. You need Node.js 22.12 or newer, Python 3.12 with `setuptools`, and, on Windows, the "Desktop development with C++" workload plus the Windows 10 SDK.

```bash
git clone https://github.com/unearthly85/every-joint-supplies.git
cd every-joint-supplies
git remote add upstream https://github.com/ChurchApps/FreeShow.git
npm install
npm start
```

Our code belongs in [`src/extensions/church/`](src/extensions/church/README.md). Read [UPSTREAM.md](UPSTREAM.md) before editing anything outside that folder. Windows signing is described in [SIGNING.md](SIGNING.md) and is off until secrets exist. What CI runs on a pull request, and how to request a full installer build, is in [TESTING.md](TESTING.md).

To produce an installer locally, the same way CI does:

```bash
npm run build
npx electron-builder --config config/building/electron-builder.fork.cjs --win nsis --publish never
```

The installer is written to `dist/`. Publishing updates to GitHub Releases is wired and turned off (`npm run release:publish` is the later switch).
