import { describe, expect, it } from "vitest"
import type { Show } from "../../../types/Show"
import { buildLibraryShow } from "../importer/save"
import { amazingGrace } from "./bundle/amazing-grace"
import { findHymn, loadCatalog } from "./catalog"
import { hymnToDraft } from "./draft"
import type { HymnRecord } from "./types"
import { assertCatalogComplete, validateHymn } from "./validate"

/** The bundled Amazing Grace with one thing broken, for the failure tests. */
function broken(changes: Record<string, unknown>): HymnRecord {
    return { ...amazingGrace, ...changes } as HymnRecord
}

/** Every word on every slide of a show, so a test can check the verse text. */
function slideText(show: Show): string {
    return Object.values(show.slides)
        .flatMap((slide) => [slide, ...(slide.children || []).map((id) => show.slides[id])])
        .flatMap((slide) => slide.items.filter((item) => item.type === "text").flatMap((item) => item.lines || []))
        .map((line) => line.text.map((part) => part.value).join(""))
        .join("\n")
}

describe("hymn catalog", () => {
    it("ships exactly the bundled hymns, and finds Amazing Grace by title and by id", () => {
        const hymns = loadCatalog()
        expect(hymns).toEqual([amazingGrace])
        expect(hymns).toHaveLength(1)
        expect(hymns[0].id).toBe("amazing-grace")
        expect(hymns[0].title).toBe("Amazing Grace")
        expect(findHymn("Amazing Grace")).toBe(hymns[0])
        expect(findHymn("amazing-grace")).toBe(hymns[0])
        expect(findHymn("  AMAZING GRACE  ")).toBe(hymns[0])
        expect(findHymn("no such hymn")).toBeNull()
        expect(findHymn("")).toBeNull()
    })

    it("keeps every shipped hymn valid, with a source line and a public domain reason", () => {
        for (const hymn of loadCatalog()) {
            expect(validateHymn(hymn)).toEqual([])
            expect(hymn.source.hymnal.trim()).not.toBe("")
            expect(hymn.source.year).toBeGreaterThan(0)
            expect(hymn.pdRationale.trim()).not.toBe("")
        }
    })

    it("treats an empty catalog as complete", () => {
        expect(assertCatalogComplete([])).toEqual([])
    })

    it("rejects a record that is missing anything it needs", () => {
        expect(validateHymn(broken({ title: "   " }))).not.toEqual([])
        expect(validateHymn(broken({ pdRationale: "" }))).not.toEqual([])
        expect(validateHymn(broken({ source: { year: 1779 } }))).not.toEqual([])
        expect(validateHymn(broken({ authors: [] }))).not.toEqual([])
        expect(validateHymn(broken({ license: "larry-holder" }))).not.toEqual([])
        expect(validateHymn(broken({ license: "WC" }))).not.toEqual([])
        expect(validateHymn(broken({ yearPublished: 1931 }))).not.toEqual([])
        expect(validateHymn(broken({ source: { hymnal: "Olney Hymns", year: 1931 } }))).not.toEqual([])
        expect(validateHymn(broken({ yearPublished: "1779" }))).not.toEqual([])
        expect(validateHymn(broken({ parts: [] }))).not.toEqual([])
        expect(validateHymn(broken({ parts: [{ id: "verse-1", label: "verse", text: "" }] }))).not.toEqual([])
        expect(validateHymn(broken({ id: "Amazing Grace" }))).not.toEqual([])
    })

    it("rejects duplicate ids and duplicate titles", () => {
        expect(assertCatalogComplete([amazingGrace, { ...amazingGrace }])).not.toEqual([])
        expect(assertCatalogComplete([amazingGrace, broken({ id: "amazing-grace-copy" })])).not.toEqual([])
        expect(assertCatalogComplete([amazingGrace, broken({ id: "amazing-grace-copy", title: "  amazing grace " })])).not.toEqual([])
        expect(assertCatalogComplete([amazingGrace, broken({ id: "another-hymn", title: "Something Else" })])).toEqual([])
    })
})

describe("hymn to draft", () => {
    it("turns Amazing Grace into a reviewable public domain draft", () => {
        const draft = hymnToDraft(amazingGrace)
        expect(draft.title).toBe("Amazing Grace")
        expect(draft.publicDomain).toBe(true)
        expect(draft.author).toContain("Newton")
        expect(draft.parts).toHaveLength(6)
        for (const part of draft.parts) {
            expect(part.repeat).toBe(1)
        }
        expect(draft.parts.some((part) => part.text.includes("saved a wretch like me"))).toBe(true)
    })

    it("builds a library show named Amazing Grace whose slides carry the verse text", () => {
        const draft = hymnToDraft(amazingGrace)
        const show = buildLibraryShow(draft, draft.title)
        expect(show.name).toBe("Amazing Grace")
        expect(slideText(show)).toContain("saved a wretch like me")
    })
})
