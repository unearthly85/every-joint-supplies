import { expect, test, type Page } from "@playwright/test"
import { launchChurchApp } from "./electronHarness"

test("a volunteer points the program audio at a specific output", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })

        await window.getByTestId("open-new-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeVisible()

        // The test environment has no real audio devices, so the select may offer only the default.
        const select = window.getByTestId("audio-device")
        await expect(select).toBeVisible()
        await expect.poll(async () => (await select.locator("option").count()) >= 1, { timeout: 10_000 }).toBe(true)
        const optionCount = await select.locator("option").count()
        expect(optionCount).toBeGreaterThanOrEqual(1)

        // The default is the system default (the ATEM's embedded HDMI audio).
        await expect(select).toHaveValue("")
        await expect.poll(() => audioDevice(window), { timeout: 10_000 }).toBe("")

        if (optionCount > 1) {
            const secondValue = await select.locator("option").nth(1).getAttribute("value")
            await select.selectOption(secondValue ?? "")
            await expect.poll(() => audioDevice(window), { timeout: 10_000 }).toBe(secondValue ?? "")

            await select.selectOption("")
            await expect.poll(() => audioDevice(window), { timeout: 10_000 }).toBe("")
        } else {
            await expect(select).toHaveValue("")
        }
    } finally {
        await launched.close()
    }
})

async function audioDevice(window: Page): Promise<string | null> {
    return window.evaluate(() => {
        const page = window as unknown as { __ejsAudioDevice?: () => string }
        return page.__ejsAudioDevice?.() ?? null
    })
}
