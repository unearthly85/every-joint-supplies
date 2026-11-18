# Testing

Churches do not run these. Every change we make under `src/extensions/church/`, and every new core-file hook listed in [UPSTREAM.md](UPSTREAM.md), ships with a test in the same change. A pull request that only edits our code and adds no test is not done.

## Layers

| Layer | What it covers | Where | In CI |
|---|---|---|---|
| Unit | Product name, feature flags, dictionary rebrand, and the Sunday service model in `src/extensions/church` | `src/extensions/church/**/*.test.ts` | Every pull request and every push to `main`. Coverage is printed and must stay at or above 90% lines/functions/statements and 80% branches for that folder. That gate covers the service module, and it is stricter than an 80% gate on the module alone. |
| Integration | Core hooks we already touch: the Electron reader refuses ChurchApps cloud sync unless the process is vitest itself | `src/extensions/church/hooks.integration.test.ts` | Same vitest run as the unit tests. |
| Installer smoke | Silent NSIS install, launch, product name, uninstall | `scripts/ci/windows-installer-smoke.ps1` | Only on the full Windows job (below). The job fails if the process does not stay up, the exe ProductName is not Every Joint Supplies, or the main window title is not that name. |
| Electron end to end | Open a new Sunday from the Faith Covenant template and see advertised time 10:30 and countdown 10:27–10:32 | `config/testing/church-present.test.ts` | Every pull request and every push to `main`, after the unit tests, on `ubuntu-latest` under xvfb. |

Lint of code we added fails the pull request: `src/extensions/church` (not the test files) and the Electron hooks `productConfig.ts` and `applyProductName.ts`. The commands do not pass `--fix`.

A full `eslint` of upstream `src/electron`, `src/frontend`, and the Svelte tree already fails, on the order of hundreds of errors (`no-console`, `no-shadow`, unused locals) that are in FreeShow as we forked it. Failing the pull request on that backlog would stay red until we restyle upstream. That cleanup is not this change. New files we add are on the blocking lint step.

## What runs when

**Every pull request, and every push to `main`.** The **Unit tests, lint, and Sunday e2e** job on `ubuntu-latest`:

- `vitest run --coverage` (all `src/**/*.test.ts`, including upstream tests and ours)
- ESLint on `src/extensions/church` (tests excluded) and on `productConfig.ts` and `applyProductName.ts`
- `npm run build`, then `npm run test:e2e:sunday` under xvfb. That is the one Playwright-for-Electron test. It reuses `config/testing/electronHarness.ts` (skip the first-run wizard, temporary store). Upstream `config/testing/start.test.ts` is not part of this job.

A failure fails the job. npm and Electron downloads are cached.

**Full Windows job.** Push to `main`, the nightly schedule (07:00 UTC), a manual `workflow_dispatch`, or a pull request labeled `full-ci`. It builds the NSIS installer on `windows-2022` and runs the smoke test, then uploads **EveryJointSupplies-windows-nsis**.

`windows-latest` is Windows Server 2025 with Visual Studio 18. Node 22's node-gyp does not detect that install, so native modules fail to compile. `windows-2022` is the image upstream FreeShow uses for its Windows release.

The smoke test:

1. Silent install (`/S`) into `%LOCALAPPDATA%\Programs\every-joint-supplies`. The job fails if that folder is missing or if `%LOCALAPPDATA%\Programs\freeshow` was created.
2. Require the exe's ProductName to be Every Joint Supplies.
3. Launch the exe and, within 30 seconds, require the process to be running and a window title of exactly Every Joint Supplies. The wait is the timeout: a hang or an early exit fails the job.
4. Silent uninstall and require the exe to be gone.

It does not open a show. Signing stays off unless the secrets in [SIGNING.md](SIGNING.md) are set.

## Sunday end to end

`config/testing/church-present.test.ts` launches the built app with `config/testing/electronHarness.ts`. Show files go to a temporary data folder, not the machine's Documents/FreeShow folder. The test opens New Sunday, checks advertised time 10:30 AM and countdown 10:27 AM–10:32 AM, starts that Sunday, and checks the project list has Pre-service, Countdown, and Service. It starts a second date, restarts on the same folder, and checks each Sunday still has its own song. After start, the panel is closed and the output preview is visible.

The harness is the piece later tasks should reuse. It writes a temporary store with the first-run wizard already finished and update prompts off, then launches Electron with `--no-sandbox`. It does not present to an output. Go Live stays a separate flow.

The job builds the app and runs only this test (`npm run test:e2e:sunday`) under xvfb. It does not run `config/testing/start.test.ts`. `windows-latest` is still the wrong image for a native build; this test stays on `ubuntu-latest`.
