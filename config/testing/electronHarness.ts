import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { _electron as electron, type ElectronApplication, type Page } from "playwright"

// Playwright compiles this file to CommonJS but leaves import.meta in place, which
// makes Node parse it as an ES module. The repo root is the process working directory:
// npm run test:e2e:sunday is run from there.
const repoRoot = process.cwd()

export interface ChurchDirs {
    store: string
    data: string
    home: string
}

/**
 * Lean Electron launch for church end-to-end tests.
 * Later tasks should call this instead of copying config/testing/start.test.ts.
 * The first-run wizard is already finished, update prompts are off, and show
 * files go to a temporary data folder rather than ~/Documents/FreeShow.
 * Pass the same dirs back in to restart against that folder.
 */
export async function launchChurchApp(existing?: ChurchDirs, prepare?: (dirs: ChurchDirs) => void): Promise<{ app: ElectronApplication; window: Page; dirs: ChurchDirs; close: (options?: { keep?: boolean }) => Promise<void> }> {
    const dirs: ChurchDirs = existing || {
        store: mkdtempSync(join(tmpdir(), "ejs-store-")),
        data: mkdtempSync(join(tmpdir(), "ejs-data-")),
        home: mkdtempSync(join(tmpdir(), "ejs-home-"))
    }
    writeConfig(dirs.store, dirs.data)
    if (!existsSync(join(dirs.store, "settings.json"))) {
        writeFileSync(join(dirs.store, "settings.json"), JSON.stringify({ initialized: true, alertUpdates: false }))
    }
    prepare?.(dirs)

    const app = await electron.launch({
        args: [repoRoot, "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--lang=en-US"],
        cwd: repoRoot,
        env: {
            ...process.env,
            HOME: dirs.home,
            LANG: "en_US.UTF-8",
            NODE_ENV: "production",
            EJS_TEST_CLOCK: "1",
            FS_MOCK_STORE_PATH: dirs.store
        }
    })

    const discard = async () => {
        await app.close().catch(() => undefined)
        rmSync(dirs.store, { recursive: true, force: true })
        rmSync(dirs.data, { recursive: true, force: true })
        rmSync(dirs.home, { recursive: true, force: true })
    }

    try {
        const window = await mainWindow(app)
        return {
            app,
            window,
            dirs,
            close: async (options) => {
                await app.close().catch(() => undefined)
                if (options?.keep) return
                rmSync(dirs.store, { recursive: true, force: true })
                rmSync(dirs.data, { recursive: true, force: true })
                rmSync(dirs.home, { recursive: true, force: true })
            }
        }
    } catch (error) {
        await discard()
        throw error
    }
}

function writeConfig(store: string, data: string) {
    const file = join(store, "config.json")
    let current: Record<string, unknown> = {}
    if (existsSync(file)) {
        try {
            current = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>
        } catch {
            current = {}
        }
    }
    writeFileSync(file, JSON.stringify({ ...current, dataPath: data }))
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
