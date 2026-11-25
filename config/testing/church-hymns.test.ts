import { expect, test } from "@playwright/test"
import { launchChurchApp } from "./electronHarness"

test("a volunteer adds a bundled hymn to the Sunday song without pasting lyrics", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("service-date").fill("2026-11-29")
        await window.getByTestId("start-sunday").click()
        await window.getByRole("button", { name: "Song", exact: true }).click()
        await expect(window.locator("#showArea .slide").first()).toBeVisible()

        await expect(window.getByTestId("hymn-search")).toBeVisible()
        await expect(window.getByTestId("hymn-results").getByTestId("hymn-result-amazing-grace")).toHaveCount(0)
        await window.getByTestId("hymn-search").fill("Amazing Grace")
        const result = window.getByTestId("hymn-results").getByTestId("hymn-result-amazing-grace")
        await expect(result).toBeVisible()
        await result.click()
        await window.getByTestId("confirm-replace").click()
        await expect(window.getByTestId("order-0")).toBeVisible()
        await expect(window.getByTestId("order-0")).toContainText("Verse 1")
        await expect(window.getByTestId("order-5")).toContainText("Verse 6")

        await window.locator("#show_sunday-2026-11-29-102700--song").getByRole("button", { name: "Amazing Grace", exact: true }).dblclick()
        await expect.poll(() => window.locator("#previewArea").innerText()).toContain("wretch like me")

        // The hymn is now a saved song, and the only "Amazing" in the library.
        await window.getByTestId("song-search").fill("Amazing")
        await expect(window.getByTestId("song-results").locator("button")).toHaveCount(1)

        // The paste box was never needed for this.
        await expect(window.getByTestId("import-paste")).toHaveCount(0)
    } finally {
        await launched.close()
    }
})
