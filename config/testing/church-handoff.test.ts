import { expect, test } from "@playwright/test"
import { launchChurchApp } from "./electronHarness"

test("a Sunday hands off from the pre-service loop to the countdown and then the announcement", async () => {
    const launched = await launchChurchApp()
    try {
        const window = launched.window
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("service-date").fill("2026-11-22")
        await window.getByTestId("start-sunday").click()
        await expect(window.getByTestId("booth-countdown")).toHaveText("Countdown starts 10:27 AM, ends 10:32 AM")

        await setClock(window, 10, 0)
        await window.getByRole("button", { name: "Welcome slides", exact: true }).dblclick()
        await expect(window.getByRole("button", { name: "Welcome slides", exact: true })).toHaveClass(/isActive/)

        await setClock(window, 10, 26)
        await expect(window.getByRole("button", { name: "Welcome slides", exact: true })).toHaveClass(/isActive/)

        await setClock(window, 10, 27)
        await expect(window.getByRole("button", { name: "Countdown video", exact: true })).toHaveClass(/isActive/)

        await setClock(window, 10, 32)
        await expect(window.getByRole("button", { name: "Announcements", exact: true })).toHaveClass(/isActive/)

        await setClock(window, 10, 0)
        await window.getByRole("button", { name: "Welcome slides", exact: true }).dblclick()
        await expect(window.getByRole("button", { name: "Welcome slides", exact: true })).toHaveClass(/isActive/)
        await window.keyboard.press("ArrowRight")
        await window.evaluate(() => (window as unknown as { __ejsTick?: () => void }).__ejsTick?.())
        await expect(window.getByRole("button", { name: "Countdown video", exact: true })).toHaveClass(/isActive/)
        await setClock(window, 10, 27)
        await expect(window.getByRole("button", { name: "Countdown video", exact: true })).toHaveClass(/isActive/)
    } finally {
        await launched.close()
    }
})

async function setClock(window: { evaluate: (fn: (clock: { hour: number; minute: number }) => void, clock: { hour: number; minute: number }) => Promise<void> }, hour: number, minute: number) {
    await window.evaluate((clock) => {
        const page = window as unknown as { __ejsNow?: () => Date; __ejsTick?: () => void }
        page.__ejsNow = () => new Date(2026, 10, 22, clock.hour, clock.minute, 0)
        page.__ejsTick?.()
    }, { hour, minute })
}
