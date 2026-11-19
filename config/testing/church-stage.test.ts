import { expect, test, type Page } from "@playwright/test"
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

interface StageOutputView {
    id: string
    stageOutput?: string
    screen?: string | null
}

const FALLBACK_BOUNDS: Bounds = { x: 0, y: 0, width: 1920, height: 1080 }

test("a volunteer puts the stage on a second screen with one click", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })

        // Open the panel once so the stage screen section publishes its test hooks.
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
        await expect(window.getByTestId("stage-screen-choice")).toBeVisible()
        await expect(window.getByTestId("stage-screen-choice").locator("option")).toHaveCount(1)
        await expect(window.getByTestId("stage-screen-choice")).toHaveValue("2")

        await window.getByTestId("use-stage-screen").click()
        await expect(window.getByTestId("stage-screen-on")).toBeVisible()

        await expect.poll(() => stageOutput(window), { timeout: 10_000 }).toMatchObject({ stageOutput: "church_confidence", screen: "2" })

        expect(await programOutputs(window)).toEqual(programBefore)

        await expect.poll(() => stageLayoutItems(window), { timeout: 10_000 }).toEqual(expect.arrayContaining(["currentText", "partLabel", "nextText", "nextItem", "clock"]))
    } finally {
        await launched.close()
    }
})

test("with only one screen, the section says to connect a second screen", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })

        await window.getByTestId("open-new-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeVisible()
        const programBefore = await programOutputs(window)
        await window.getByTestId("close-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeHidden()

        await fakeDisplays(window, [{ id: 1, bounds: programBefore[0]?.bounds ?? FALLBACK_BOUNDS }])

        await window.getByTestId("open-new-sunday").click()
        await expect(window.getByTestId("stage-no-screen")).toBeVisible()
        await expect(window.getByTestId("use-stage-screen")).toHaveCount(0)
        await expect(window.getByTestId("stage-screen-choice")).toHaveCount(0)
    } finally {
        await launched.close()
    }
})

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

async function stageOutput(window: Page): Promise<StageOutputView | null> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsStageOutput?: () => StageOutputView | null }
        return page.__ejsStageOutput?.() ?? null
    })
}

async function stageLayoutItems(window: Page): Promise<string[] | null> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsStageLayout?: () => { items?: { [key: string]: unknown } } | null }
        const layout = page.__ejsStageLayout?.()
        return layout ? Object.keys(layout.items || {}) : null
    })
}
