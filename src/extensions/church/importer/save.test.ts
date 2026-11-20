import { describe, expect, it } from "vitest"
import { buildLibraryShow, findSameTitle } from "./save"
import type { SongDraft } from "./draft"

function draft(): SongDraft {
    return {
        title: "Hiding in the Light",
        parts: [
            { id: "part-1", label: "verse", text: "Verse one", repeat: 1 },
            { id: "part-2", label: "chorus", text: "Chorus", repeat: 1 },
            { id: "part-3", label: "verse", text: "Verse two", repeat: 1 }
        ],
        ccli: "1234567"
    }
}

describe("findSameTitle", () => {
    const songs = {
        a: { name: "Amazing Grace" },
        b: { name: "Hiding in the Light" },
        c: { name: "Ode to Joy" }
    }

    it("matches a name case-insensitively and after trimming", () => {
        expect(findSameTitle("  HIDING IN THE LIGHT ", songs)).toEqual({ id: "b", name: "Hiding in the Light" })
    })

    it("returns the first match when several songs share a name", () => {
        expect(findSameTitle("amazing grace", { a: { name: "Amazing Grace" }, z: { name: "amazing grace" } })).toEqual({ id: "a", name: "Amazing Grace" })
    })

    it("returns null for an empty or blank name", () => {
        expect(findSameTitle("", songs)).toBeNull()
        expect(findSameTitle("   ", songs)).toBeNull()
    })

    it("returns null when no song has the name", () => {
        expect(findSameTitle("Something New", songs)).toBeNull()
    })
})

describe("buildLibraryShow", () => {
    it("sets the name, a fresh id, and the default arrangement", () => {
        const show = buildLibraryShow(draft(), "Hiding in the Light")
        expect(show.name).toBe("Hiding in the Light")
        expect(show.id).toBeTruthy()
        expect(show.category).toBe("song")
        expect(show.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(["part-1", "part-2", "part-3"])
        expect(Object.keys(show.slides)).toEqual(["part-1", "part-2", "part-3"])
    })

    it("uses a different id on every call", () => {
        expect(buildLibraryShow(draft(), "Song").id).not.toBe(buildLibraryShow(draft(), "Song").id)
    })

    it("applies the reviewer's arrangement order and repeats", () => {
        const show = buildLibraryShow(draft(), "Song", ["part-2", "part-1", "part-2"])
        expect(show.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(["part-2", "part-1", "part-2"])
    })

    it("drops arrangement ids that are not parts of the draft", () => {
        const show = buildLibraryShow(draft(), "Song", ["part-9", "part-1", "part-9"])
        expect(show.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(["part-1"])
    })

    it("keeps the default arrangement when the given one is empty", () => {
        const show = buildLibraryShow(draft(), "Song", [])
        expect(show.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(["part-1", "part-2", "part-3"])
    })

    it("falls back to the draft title when the name is blank", () => {
        const show = buildLibraryShow(draft(), "")
        expect(show.name).toBe("Hiding in the Light")
    })
})
