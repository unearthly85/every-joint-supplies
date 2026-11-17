# Testing and CI

Churches do not use this. It is how we keep pull requests cheap and still prove the Windows installer.

## Every pull request

The **CI** workflow runs **Unit tests and lint** on `ubuntu-latest`:

- `npm test` at the unit level: `npm run test:unit`
- ESLint for the Electron main process, the frontend, and Svelte
- ESLint for `src/extensions/church`, which fails the job if our extension code is wrong

Upstream's own lint already fails on a backlog (`no-console`, `no-shadow`, unused locals). Those three ESLint steps are reported and do not fail the job. The extension lint step does.

Playwright (`npm run test:playwright`) is not part of this job. It needs a production build of the app, so it is not a fast check. Run it locally when you change output or startup behavior.

npm and Electron downloads are cached from `package-lock.json` (`ELECTRON_CACHE` and `ELECTRON_BUILDER_CACHE`).

## Full Windows installer

**Windows NSIS installer** builds `dist/EveryJointSupplies-<version>-x64.exe`, uploads it as the artifact **EveryJointSupplies-windows-nsis**, then runs `scripts/ci/windows-installer-smoke.ps1`:

1. Silent install (`/S`) into `%LOCALAPPDATA%\Programs\EveryJointSupplies`
2. Launch `EveryJointSupplies.exe` and require the process to still be running after 15 seconds
3. Silent uninstall and require the exe to be gone

That smoke test does not click through a show. It checks that the package installs, the process starts, and uninstall removes it.

The installer job does not run on a normal pull request. It runs only when:

- the workflow is a push to `main` (including a merge)
- the nightly schedule fires (07:00 UTC)
- someone starts the workflow by hand (`workflow_dispatch`)
- the pull request has the **`full-ci`** label

Add `full-ci` when a change can break packaging or startup and you need the installer proved before merge. New commits on a labeled pull request run the installer again. Removing the label does not cancel a run that already started.

Signing stays off unless the secrets in [SIGNING.md](SIGNING.md) are set. The smoke test expects an unsigned installer and does not click through SmartScreen.
