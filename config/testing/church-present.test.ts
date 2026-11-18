import { expect, test } from "@playwright/test"
import { launchChurchApp } from "./electronHarness"

test("a new Sunday from the template shows 10:30, 10:27, and 10:32", async () => {
    const launched = await launchChurchApp()
    try {
        const panel = launched.window.getByTestId("new-sunday")
        await panel.waitFor({ timeout: 60_000 })
        await expect(launched.window).toHaveTitle("Every Joint Supplies")
        await expect(launched.window.getByTestId("advertised-time")).toHaveValue(/^10:30/)
        await expect(launched.window.getByTestId("start-time")).toHaveValue(/^10:27/)
        await expect(launched.window.getByTestId("countdown-line")).toHaveText("Countdown starts 10:27, ends 10:32")
        await launched.window.getByTestId("start-sunday").click()
        await expect(launched.window.getByTestId("sunday-ready")).toContainText("Advertised time 10:30")
    } finally {
        await launched.close()
    }
})
