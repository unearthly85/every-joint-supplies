import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { _electron as electron, type ElectronApplication, type Page } from "playwright"

// Playwright compiles this file to CommonJS but leaves import.meta in place, which
// makes Node parse it as an ES module. The repo root is the process working directory:
// npm run test:e2e:sunday is run from there.
const repoRoot = process.cwd()

/**
 * Lean Electron launch for church end-to-end tests.
 * Later tasks (the timer, and anything else that needs the booth) should call
 * this instead of copying config/testing/start.test.ts. It skips the first-run
 * wizard and does not ask about updates.
 */
export async function launchChurchApp(): Promise<{ app: ElectronApplication; window: Page; close: () => Promise<void> }> {
    const store = mkdtempSync(join(tmpdir(), "ejs-store-"))
    writeFileSync(join(store, "settings.json"), JSON.stringify({ initialized: true, alertUpdates: false }))

    const app = await electron.launch({
        args: [repoRoot, "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
        cwd: repoRoot,
        env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: store }
    })

    try {
        const window = await mainWindow(app)
        return {
            app,
            window,
            close: async () => {
                await app.close().catch(() => undefined)
                rmSync(store, { recursive: true, force: true })
            }
        }
    } catch (error) {
        await app.close().catch(() => undefined)
        rmSync(store, { recursive: true, force: true })
        throw error
    }
}

async function mainWindow(app: ElectronApplication): Promise<Page> {
    const started = Date.now()
    while (Date.now() - started < 60_000) {
        const found = app.windows().find((page) => page.url().includes("index.html"))
        if (found) return found
        await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error("The main window did not open")
}
