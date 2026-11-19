import { expect, test, type ElectronApplication, type Page } from "@playwright/test"
import { launchChurchApp } from "./electronHarness"

interface Bounds {
    x: number
    y: number
    width: number
    height: number
}

interface ProgramOutputView {
    id: string
    screen: string | null
    bounds: Bounds
}

interface ChurchProgramOutputView {
    id: string
    name?: string
    screen?: string | null
    bounds?: Bounds
    stageOutput?: string
    ndi?: boolean
    rtmp?: boolean
}

const FALLBACK_BOUNDS: Bounds = { x: 0, y: 0, width: 1920, height: 1080 }

test("a volunteer puts the program on a second screen with one click", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })

        // Open the panel once so the program screen section publishes its test hooks.
        await window.getByTestId("open-new-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeVisible()
        const programBefore = await programOutputs(window)
        await window.getByTestId("close-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeHidden()

        await fakeDisplays(window, [
            { id: 1, bounds: programBefore[0]?.bounds ?? FALLBACK_BOUNDS },
            { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
        ])

        await window.getByTestId("open-new-sunday").click()
        await expect(window.getByTestId("program-screen-choice")).toBeVisible()
        await expect(window.getByTestId("program-screen-choice").locator("option")).toHaveCount(1)
        await expect(window.getByTestId("program-screen-choice")).toHaveValue("2")

        await window.getByTestId("use-program-screen").click()
        await expect(window.getByTestId("program-screen-on")).toBeVisible()

        await expect
            .poll(() => programOutput(window), { timeout: 10_000 })
            .toMatchObject({
                name: "Program",
                screen: "2",
                bounds: { x: 1920, y: 0, width: 1920, height: 1080 }
            })
        const created = await programOutput(window)
        expect(created?.stageOutput).toBeFalsy()
        expect(created?.ndi).toBeFalsy()
        expect(created?.rtmp).toBeFalsy()

        // The existing Primary output stays where it was.
        const primaryBefore = programBefore.find((item) => item.id !== created?.id)
        const after = await programOutputs(window)
        expect(after.find((item) => item.id === primaryBefore?.id)).toEqual(primaryBefore)

        // A second window opens for the program, with no operator chrome.
        const outputWindow = await secondWindow(launched.app, window)
        await expect(outputWindow.locator('div[class~="#output_window"]')).toBeVisible({ timeout: 30_000 })
        await expect(outputWindow.getByTestId("open-new-sunday")).toHaveCount(0)
    } finally {
        await launched.close()
    }
})

async function secondWindow(app: ElectronApplication, main: Page): Promise<Page> {
    const started = Date.now()
    while (Date.now() - started < 30_000) {
        const found = app.windows().find((page) => page !== main && page.url().includes("index.html"))
        if (found) return found
        await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error("The program output window did not open")
}

async function fakeDisplays(window: Page, displays: { id: number; bounds: Bounds }[]) {
    await window.evaluate((list) => {
        ;(globalThis as { __ejsFakeDisplays?: unknown }).__ejsFakeDisplays = list
    }, displays)
}

async function programOutputs(window: Page): Promise<ProgramOutputView[]> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsProgramOutputs?: () => ProgramOutputView[] }
        return page.__ejsProgramOutputs?.() ?? []
    })
}

async function programOutput(window: Page): Promise<ChurchProgramOutputView | null> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsProgramOutput?: () => ChurchProgramOutputView | null }
        return page.__ejsProgramOutput?.() ?? null
    })
}
