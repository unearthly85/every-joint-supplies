import { expect, test, type Page } from "@playwright/test"
import { mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { launchChurchApp } from "./electronHarness"

const FIRST_SHOWS = [
    "Sunday 2026-11-22 – Announcements.show",
    "Sunday 2026-11-22 – Scripture.show",
    "Sunday 2026-11-22 – Song.show",
    "Sunday 2026-11-22 – Welcome slides.show"
]

test("two Sundays keep their own songs, and the preview is visible after start", async () => {
    mkdirSync("/opt/cursor/artifacts", { recursive: true })
    const first = await launchChurchApp()
    const dirs = first.dirs
    try {
        const window = first.window
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await expect(window).toHaveTitle("Every Joint Supplies")
        await expect(window.getByTestId("new-sunday")).toHaveCount(0)
        await expect(window.locator("#previewArea")).toBeVisible()
        await expectNoOverlap(window, "Projects")
        await window.locator(".tabs .header").screenshot({ path: "/opt/cursor/artifacts/projects-header.png" })

        await window.getByTestId("open-new-sunday").click()
        const panel = window.getByTestId("new-sunday")
        await expect(panel).toBeVisible()
        await expect(window.getByTestId("advertised-time")).toHaveValue("10:30 AM")
        await expect(window.getByTestId("start-time")).toHaveValue("10:27 AM")
        await expect(window.getByTestId("countdown-minutes")).toHaveValue("5")
        await expect(window.getByTestId("countdown-seconds")).toHaveValue("0")
        await expect(window.getByTestId("countdown-line")).toHaveText("Countdown starts 10:27 AM, ends 10:32 AM")

        await window.getByTestId("service-date").fill("2026-11-22")
        await window.getByTestId("start-sunday").click()
        await expect(panel).toBeHidden()
        await expect(window.locator("#previewArea")).toBeVisible()
        await expect(window.getByText("Sunday 2026-11-22", { exact: true })).toBeVisible()
        await expect(window.getByText("Pre-service", { exact: true })).toBeVisible()
        await expect(window.getByText("Countdown", { exact: true })).toBeVisible()
        await expect(window.getByText("Service", { exact: true })).toBeVisible()
        await expect(window.getByRole("button", { name: "Song", exact: true })).toBeVisible()
        await expectNoOverlap(window, "Sunday 2026-11-22")
        await window.locator(".tabs .header").screenshot({ path: "/opt/cursor/artifacts/project-header.png" })

        await window.getByText("Countdown", { exact: true }).click()
        await expect(window.locator("#showArea input[type='time']")).toHaveValue("10:27")

        const showsDir = join(dirs.data, "Shows")
        await expect.poll(() => safeList(showsDir).sort(), { timeout: 20_000 }).toEqual(FIRST_SHOWS)

        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("service-date").fill("2026-11-22")
        await window.getByTestId("start-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeHidden()
        await expect(window.getByText("Sunday 2026-11-22", { exact: true })).toBeVisible()
        expect(safeList(showsDir).sort()).toEqual(FIRST_SHOWS)

        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("service-date").fill("2026-11-29")
        await window.getByTestId("start-sunday").click()
        await expect(window.getByTestId("new-sunday")).toBeHidden()
        await expect(window.getByRole("button", { name: "Song", exact: true })).toBeVisible()
        await expect
            .poll(() => safeList(showsDir), { timeout: 20_000 })
            .toEqual(expect.arrayContaining([...FIRST_SHOWS, "Sunday 2026-11-29 – Song.show"]))
    } finally {
        await first.close({ keep: true })
    }

    const second = await launchChurchApp(dirs)
    try {
        const window = second.window
        await window.getByText("Sunday 2026-11-29", { exact: true }).waitFor({ timeout: 60_000 })
        await expect(window.getByRole("button", { name: "Song", exact: true })).toBeVisible()
        await window.locator("[data-title='Projects']").click()
        await window.getByRole("button", { name: "Sunday 2026-11-22", exact: true }).click()
        await expect(window.getByRole("button", { name: "Song", exact: true })).toBeVisible()
        await expect(window.getByText("Pre-service", { exact: true })).toBeVisible()
        await window.locator("[data-title='Projects']").click()
        await window.getByRole("button", { name: "Sunday 2026-11-29", exact: true }).click()
        await expect(window.getByText("Sunday 2026-11-29", { exact: true })).toBeVisible()
        await expect(window.getByRole("button", { name: "Song", exact: true })).toBeVisible()
    } finally {
        await second.close()
    }
})

async function expectNoOverlap(window: Page, title: string) {
    const titleBox = await window.locator(".tabs .header p", { hasText: title }).boundingBox()
    const buttonBox = await window.getByTestId("open-new-sunday").boundingBox()
    expect(titleBox).toBeTruthy()
    expect(buttonBox).toBeTruthy()
    const overlaps = titleBox!.x < buttonBox!.x + buttonBox!.width && titleBox!.x + titleBox!.width > buttonBox!.x && titleBox!.y < buttonBox!.y + buttonBox!.height && titleBox!.y + titleBox!.height > buttonBox!.y
    expect(overlaps).toBe(false)
}

function safeList(dir: string): string[] {
    try {
        return readdirSync(dir)
    } catch {
        return []
    }
}
