import { test } from "@playwright/test"

/**
 * Scaffold for a Sunday-flow Electron test. Not executed.
 *
 * The intended test is: launch the app, open the built-in Welcome show, and
 * present it to a windowed output. That path is not wired into CI in this
 * change. Reasons:
 *
 * - It needs a production Electron build (`npm run build`) plus a display.
 *   On Linux that means xvfb. That is several minutes, so it does not belong
 *   on the fast pull-request job.
 * - windows-latest cannot compile the native addons (Visual Studio 18), so
 *   it cannot build the app the test would launch.
 * - FreeShow's Go Live control stays disabled until an output exists
 *   (`Top.svelte`). Turning on a windowed output goes through the output
 *   settings, which upstream's own `config/testing/start.test.ts` does not
 *   cover. The Welcome show is also behind the first-run wizard.
 *
 * `config/testing/start.test.ts` is the existing launch harness. Extend this
 * test from that harness once the output selectors are stable, then run it
 * with the full-ci job under xvfb.
 */
test.fixme("app launches, opens the sample show, and presents to a windowed output", async () => {
    // 1. Launch Electron the way config/testing/start.test.ts does
    //    (_electron.launch, --no-sandbox, a temporary FS_MOCK_STORE_PATH).
    // 2. Wait for the index.html window and expect its title to be
    //    "Every Joint Supplies".
    // 3. Finish or skip the first-run wizard, then open the Welcome show
    //    created by createDefaultShow.
    // 4. Enable a windowed output and send that show to it. Fail if the
    //    output window never appears.
})
