# Testing

Churches do not run these. Every change we make under `src/extensions/church/`, and every new core-file hook listed in [UPSTREAM.md](UPSTREAM.md), ships with a test in the same change. A pull request that only edits our code and adds no test is not done.

## Layers

| Layer | What it covers | Where | In CI |
|---|---|---|---|
| Unit | Product name, feature flags, and dictionary rebrand in `src/extensions/church` | `src/extensions/church/*.test.ts` | Every pull request and every push to `main`. Coverage is printed and must stay at or above 90% lines/functions/statements and 80% branches for that folder. |
| Integration | Core hooks we already touch: the Electron reader refuses ChurchApps cloud sync unless the process is vitest itself | `src/extensions/church/hooks.integration.test.ts` | Same vitest run as the unit tests. |
| Installer smoke | Silent NSIS install, launch, product name, uninstall | `scripts/ci/windows-installer-smoke.ps1` | Only on the full Windows job (below). The job fails if the process does not stay up, the exe ProductName is not Every Joint Supplies, or the main window title is not that name. |
| Electron end to end | Launch, open the Welcome show, present to a windowed output | `config/testing/church-present.test.ts` | Not run. The file is a scaffold (`test.fixme`). See below. |

Lint of code we added fails the pull request: `src/extensions/church` (not the test files) and the Electron hooks `productConfig.ts` and `applyProductName.ts`. The commands do not pass `--fix`.

A full `eslint` of upstream `src/electron`, `src/frontend`, and the Svelte tree already fails, on the order of hundreds of errors (`no-console`, `no-shadow`, unused locals) that are in FreeShow as we forked it. Failing the pull request on that backlog would stay red until we restyle upstream. That cleanup is not this change. New files we add are on the blocking lint step.

## What runs when

**Every pull request, and every push to `main`.** The **Unit tests and lint** job on `ubuntu-latest`:

- `vitest run --coverage` (all `src/**/*.test.ts`, including upstream tests and ours)
- The four ESLint commands above

A failure fails the job. npm and Electron downloads are cached.

**Full Windows job.** Push to `main`, the nightly schedule (07:00 UTC), a manual `workflow_dispatch`, or a pull request labeled `full-ci`. It builds the NSIS installer on `windows-2022` and runs the smoke test, then uploads **EveryJointSupplies-windows-nsis**.

`windows-latest` is Windows Server 2025 with Visual Studio 18. Node 22's node-gyp does not detect that install, so native modules fail to compile. `windows-2022` is the image upstream FreeShow uses for its Windows release.

The smoke test:

1. Silent install (`/S`) into `%LOCALAPPDATA%\Programs\every-joint-supplies`. The job fails if that folder is missing or if `%LOCALAPPDATA%\Programs\freeshow` was created.
2. Require the exe's ProductName to be Every Joint Supplies.
3. Launch the exe and, within 30 seconds, require the process to be running and a window title of exactly Every Joint Supplies. The wait is the timeout: a hang or an early exit fails the job.
4. Silent uninstall and require the exe to be gone.

It does not open a show. Signing stays off unless the secrets in [SIGNING.md](SIGNING.md) are set.

## Electron end to end is not in CI yet

`config/testing/church-present.test.ts` is the scaffold for "launch, open the Welcome show, present to a windowed output". It is `test.fixme`, so a Playwright run records it as not executed.

That flow is not feasible to enforce in this change:

- It needs `npm run build` and a display (xvfb on Linux). That is several minutes, so it does not belong on the pull-request job.
- `windows-latest` cannot compile the native addons, so it cannot build the app the test would launch.
- Go Live stays disabled until an output exists (`Top.svelte`). Creating a windowed output goes through output settings. Upstream's `config/testing/start.test.ts` gets through the first-run wizard and creates a show; it does not present. The Welcome show from `createDefaultShow` is behind that same wizard.

When the selectors are stable, drop `test.fixme`, follow the launch setup in `config/testing/start.test.ts`, and run it under xvfb on the full-ci job. Until then, do not treat a green pull request as proof of the Sunday present flow.
