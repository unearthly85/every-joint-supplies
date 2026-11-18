import { expect, test, type Page } from "@playwright/test"
import { join } from "node:path"
import { launchChurchApp } from "./electronHarness"

const clip = join(process.cwd(), "config/testing/fixtures/countdown-short.mp4")

test("the live output follows the countdown, a go-back, an early click, and mode B", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("countdown-video").setInputFiles(clip)
        await window.getByTestId("service-date").fill("2026-11-22")
        await window.getByTestId("start-sunday").click()
        await expect(window.getByTestId("booth-countdown")).toHaveText("Countdown starts 10:27 AM, ends 10:27:01 AM")
        await expect(window.getByTestId("booth-remaining")).not.toHaveText("—")

        await expect.poll(() => flag(window, "__ejsTestClock"), { timeout: 8000 }).toBe(true)

        await setClock(window, 10, 0)
        await window.getByRole("button", { name: "Welcome slides", exact: true }).dblclick()
        await expect.poll(() => outputText(window)).toContain("Welcome")
        await setClock(window, 10, 0)

        await setClock(window, 10, 5)
        await window.getByRole("button", { name: "Welcome slides", exact: true }).dblclick()
        await window.locator("#showArea").getByText("Welcome", { exact: true }).click()
        await setClock(window, 10, 5)
        await expect.poll(() => outputText(window)).toContain("Welcome")

        await window.locator("#show_sunday-2026-11-22-102700--scripture").getByRole("button", { name: "Scripture" }).click()
        await setClock(window, 10, 27)
        await expect.poll(() => outputSnapshot(window), { timeout: 8000 }).toContain("playing countdown-short")

        await expect.poll(() => outputText(window), { timeout: 8000 }).toContain("Announcements")

        await setClock(window, 10, 40)
        await window.getByRole("button", { name: "Welcome slides", exact: true }).dblclick()
        await setClock(window, 10, 40)
        await expect.poll(() => outputText(window)).toContain("Welcome")

        await setClock(window, 10, 10)
        await window.getByRole("button", { name: "Announcements", exact: true }).dblclick()
        await expect.poll(() => outputText(window)).toContain("Announcements")
        await setClock(window, 10, 27)
        await expect.poll(() => outputText(window)).toContain("Announcements")
        expect(await outputBackground(window)).not.toContain("countdown-short")
        await expect(window.getByTestId("booth-remaining")).toHaveText("Auto-advance off for this item")

        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("countdown-finishes-at-start").check()
        await window.getByTestId("start-time").fill("10:30 AM")
        await window.getByTestId("start-time").blur()
        await window.getByTestId("countdown-video").setInputFiles(clip)
        await expect(window.getByTestId("countdown-seconds")).toHaveValue("1")
        await window.getByTestId("countdown-minutes").fill("5")
        await window.getByTestId("countdown-seconds").fill("0")
        await window.getByTestId("service-date").fill("2026-11-29")
        await window.getByTestId("start-sunday").click()
        await setClockOn(window, "2026-11-29", 10, 24)
        await window.getByRole("button", { name: "Welcome slides", exact: true }).dblclick()
        await expect.poll(() => outputText(window)).toContain("Welcome")
        await setClockOn(window, "2026-11-29", 10, 24)
        await setClockOn(window, "2026-11-29", 10, 25)
        await expect.poll(() => outputSnapshot(window), { timeout: 8000 }).toContain("playing countdown-short")
    } finally {
        await launched.close()
    }
})

async function outputText(window: Page): Promise<string> {
    return window.locator("#previewArea").innerText()
}

async function flag(window: Page, name: string): Promise<boolean> {
    return window.evaluate((key) => (window as unknown as Record<string, unknown>)[key] === true, name)
}

/** Output store plus the preview video. "playing <name>" means that clip is on the output and moving. */
async function outputSnapshot(window: Page): Promise<string> {
    return window.evaluate(() => {
        const page = window as unknown as {
            __ejsOutput?: () => { background?: string; slideId?: string; playing?: { path: string; paused: boolean; time: number }[] }
        }
        const live = page.__ejsOutput?.() || { background: "", slideId: "", playing: [] }
        const videos = [...document.querySelectorAll("#previewArea video")] as HTMLVideoElement[]
        const preview = videos.map((video) => video.currentSrc || video.src || "").join(" ")
        const clip = "countdown-short"
        const player = (live.playing || []).some((item) => item.path.includes(clip) && (!item.paused || item.time > 0))
        const previewPlaying = videos.some((video) => {
            const src = video.currentSrc || video.src || ""
            return src.includes(clip) && (!video.paused || video.currentTime > 0)
        })
        const named = `${live.background || ""} ${preview}`
        const state = named.includes(clip) && (player || previewPlaying) ? "playing countdown-short" : "idle"
        return `${state} background=${live.background || ""} slide=${live.slideId || ""} preview=${preview}`
    })
}

async function outputBackground(window: Page): Promise<string> {
    const snapshot = await outputSnapshot(window)
    const match = snapshot.match(/background=([^ ]*)/)
    return match?.[1] || ""
}

async function setClock(window: Page, hour: number, minute: number) {
    await setClockOn(window, "2026-11-22", hour, minute)
}

async function setClockOn(window: Page, date: string, hour: number, minute: number) {
    await window.evaluate((clock) => {
        const page = window as unknown as { __ejsNow?: () => Date; __ejsTick?: () => void }
        const [year, month, day] = clock.date.split("-").map(Number)
        page.__ejsNow = () => new Date(year, month - 1, day, clock.hour, clock.minute, 0)
        page.__ejsTick?.()
    }, { date, hour, minute })
}
