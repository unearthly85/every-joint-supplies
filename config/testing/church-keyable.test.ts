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

interface KeyableOutputView {
    id: string
    name?: string
    screen?: string | null
    bounds?: Bounds
    style?: string
}

interface KeyableStyleView {
    name?: string
    layers?: string[]
    background?: string
}

const FALLBACK_BOUNDS: Bounds = { x: 0, y: 0, width: 1920, height: 1080 }

test("a volunteer turns the keyable lower-thirds on and off with one switch", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })

        // Open the panel once so the screen sections publish their test hooks.
        await window.getByTestId("open-new-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeVisible()
        const programBefore = await programOutputs(window)
        await window.getByTestId("close-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeHidden()

        await fakeDisplays(window, [
            { id: 1, bounds: programBefore[0]?.bounds ?? FALLBACK_BOUNDS },
            { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } },
            { id: 3, bounds: { x: 3840, y: 0, width: 1920, height: 1080 } }
        ])

        await window.getByTestId("open-new-sunday").click()
        await expect(window.getByTestId("program-screen-choice")).toBeVisible()
        await expect(window.getByTestId("program-screen-choice")).toHaveValue("2")
        await window.getByTestId("use-program-screen").click()
        await expect(window.getByTestId("program-screen-on")).toBeVisible()
        await expect.poll(() => programOutput(window), { timeout: 10_000 }).toMatchObject({ name: "Program", screen: "2" })
        const programOn = await programOutput(window)

        await window.getByTestId("keyable-toggle").check()
        await expect.poll(() => keyableOutput(window), { timeout: 10_000 }).toMatchObject({ style: "church_keyable", screen: "3" })
        await expect.poll(() => keyableStyle(window), { timeout: 10_000 }).not.toBeNull()

        await window.getByTestId("keyable-toggle").uncheck()
        await expect.poll(() => keyableOutput(window), { timeout: 10_000 }).toBeNull()

        // The program output stayed where it was.
        expect(await programOutput(window)).toEqual(programOn)
    } finally {
        await launched.close()
    }
})

test("with no free screen, the switch says to connect another screen", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })

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
        await expect(window.getByTestId("program-screen-choice")).toHaveValue("2")
        await window.getByTestId("use-program-screen").click()
        await expect(window.getByTestId("program-screen-on")).toBeVisible()

        // The switch reverts to off when there is no screen left, so click it instead of checking it.
        await window.getByTestId("keyable-toggle").click()
        await expect(window.getByTestId("keyable-no-screen")).toBeVisible()
        expect(await keyableOutput(window)).toBeNull()
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

async function programOutput(window: Page): Promise<(ProgramOutputView & { name?: string }) | null> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsProgramOutput?: () => (ProgramOutputView & { name?: string }) | null }
        return page.__ejsProgramOutput?.() ?? null
    })
}

async function keyableOutput(window: Page): Promise<KeyableOutputView | null> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsKeyableOutput?: () => KeyableOutputView | null }
        return page.__ejsKeyableOutput?.() ?? null
    })
}

async function keyableStyle(window: Page): Promise<KeyableStyleView | null> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsKeyableStyle?: () => KeyableStyleView | null }
        return page.__ejsKeyableStyle?.() ?? null
    })
}
