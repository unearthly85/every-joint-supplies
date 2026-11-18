import { expect, test } from "@playwright/test"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { launchChurchApp } from "./electronHarness"

const library = {
    name: "Amazing Grace",
    origin: "",
    category: null,
    settings: { activeLayout: "default", template: null },
    timestamps: { created: 1, modified: null, used: null },
    meta: {},
    slides: {
        "verse-1": part("verse", "First verse"),
        chorus: part("chorus", "Sing the chorus"),
        "verse-2": part("verse", "Second verse"),
        bridge: part("bridge", "The bridge"),
        tag: part("tag", "The tag")
    },
    layouts: {
        default: { name: "Default", notes: "", slides: [{ id: "verse-1" }, { id: "chorus" }, { id: "verse-2" }, { id: "chorus" }, { id: "bridge" }] }
    },
    media: {}
}

function part(group: string, text: string) {
    return {
        group,
        globalGroup: group,
        color: null,
        settings: {},
        notes: "",
        items: [{ type: "text", style: "top:88px;left:50px;height:904px;width:1820px;", lines: [{ align: "", text: [{ value: text, style: "" }] }] }]
    }
}

test("a Sunday order overrides a saved song and the library file stays put", async () => {
    const file = JSON.stringify(["amazing-grace", library])
    const launched = await launchChurchApp(undefined, (dirs) => {
        const folder = join(dirs.data, "Shows")
        mkdirSync(folder, { recursive: true })
        writeFileSync(join(folder, "Amazing Grace.show"), file)
    })
    const window = launched.window
    const saved = join(launched.dirs.data, "Shows", "Amazing Grace.show")
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("service-date").fill("2026-11-22")
        await window.getByTestId("start-sunday").click()
        await window.getByRole("button", { name: "Song", exact: true }).click()
        await window.getByTestId("use-library-amazing-grace").click()
        await expect(window.getByTestId("order-0")).toContainText("Verse 1")
        await expect(window.getByTestId("order-1")).toContainText("Chorus")
        await window.getByTestId("add-tag").click()
        await expect(window.getByTestId("order-5")).toContainText("Tag")

        await window.locator("#show_sunday-2026-11-22-102700--song").getByRole("button", { name: "Amazing Grace", exact: true }).dblclick()
        await expect.poll(() => window.locator("#previewArea").innerText()).toContain("First verse")
        await window.keyboard.press("c")
        await expect.poll(() => window.locator("#previewArea").innerText()).toContain("Sing the chorus")
        await expect(window.getByTestId("next-part")).toHaveText("Next: Verse 2")
        await window.keyboard.press("ArrowRight")
        await expect.poll(() => window.locator("#previewArea").innerText()).toContain("Second verse")
        expect(readFileSync(saved, "utf8")).toBe(file)
    } finally {
        await launched.close()
    }
})
