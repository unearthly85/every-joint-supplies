import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { faithCovenantSunday, toStored } from "./model"

/**
 * Fails when FreeShow renames the project or show fields this module writes.
 * The strings are the current upstream declarations, not a copy of our format.
 */
describe("upstream project and show shape", () => {
    const projects = readFileSync(new URL("../../../types/Projects.ts", import.meta.url), "utf8")
    const show = readFileSync(new URL("../../../types/Show.ts", import.meta.url), "utf8")
    const save = readFileSync(new URL("../../../frontend/utils/save.ts", import.meta.url), "utf8")

    it("still declares the project list, section data, and show layout we store a Sunday in", () => {
        expect(projects).toContain("shows: ProjectShowRef[]")
        expect(projects).toContain("data?: any")
        expect(projects).toContain('type?: ShowType')
        expect(show).toContain("slides: { [key: ID]: Slide }")
        expect(show).toContain("layouts: { [key: ID]: Layout }")
        expect(show).toContain("group: null | string")
        expect(show).toContain("slides: SlideData[]")
        expect(show).toContain("nextTimer?: number")
        expect(show).toContain("nextAfterMedia?: boolean")
    })

    it("still removes the fields a Sunday must not depend on after save", () => {
        expect(save).toContain("delete (data[id] as any).timestamps")
        expect(save).toContain("delete (data[id] as any).settings")
        expect(save).toContain("delete slide.id")
        expect(save).toContain("delete show.layout")
    })

    it("writes a stored Sunday with those fields present", () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        expect(stored.project).toEqual(expect.objectContaining({ name: expect.any(String), created: expect.any(Number), parent: "/", shows: expect.any(Array) }))
        const section = stored.project.shows[0]
        expect(section.type).toBe("section")
        expect(section.data.church.kind).toBe("pre_service_loop")
        const song = Object.values(stored.shows).find((item) => item.layouts.arrangement.slides.length > 1)
        expect(song).toEqual(expect.objectContaining({ slides: expect.any(Object), layouts: expect.any(Object), media: expect.any(Object), meta: expect.any(Object) }))
        expect(song?.slides["verse-1"].group).toBe("verse")
        expect(song?.settings.activeLayout).toBe("arrangement")
    })
})
