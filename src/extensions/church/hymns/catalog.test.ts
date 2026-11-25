import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { Show } from "../../../types/Show"
import { buildLibraryShow } from "../importer/save"
import { amazingGrace } from "./bundle/amazing-grace"
import { findHymn, loadCatalog } from "./catalog"
import { hymnToDraft } from "./draft"
import { PD_CUTOFF_YEAR, type HymnRecord } from "./types"
import { assertCatalogComplete, validateHymn } from "./validate"

/** The twelve hymns in the starter set, in the order the catalog ships them. */
const STARTER_SET_IDS = ["amazing-grace", "holy-holy-holy", "come-thou-fount", "when-i-survey", "what-a-friend", "blessed-assurance", "it-is-well", "just-as-i-am", "rock-of-ages", "a-mighty-fortress", "all-hail-the-power", "how-firm-a-foundation"]

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

/** The Title column of the bundled-hymns table in HYMNS.md. */
function hymnsMdTitles(): string[] {
    const markdown = readFileSync(new URL("./HYMNS.md", import.meta.url), "utf8")
    return markdown
        .split("\n")
        .filter((line) => line.startsWith("|"))
        .map(
            (line) =>
                line
                    .split("|")
                    .map((cell) => cell.trim())
                    .slice(1)[0]
        )
        .filter((title) => title && title !== "Title" && !/^[-\s]+$/.test(title))
}

describe("hymn catalog", () => {
    it("ships exactly the bundled hymns, and finds Amazing Grace by title and by id", () => {
        const hymns = loadCatalog()
        expect(hymns.map((hymn) => hymn.id)).toEqual(STARTER_SET_IDS)
        expect(hymns[0].id).toBe("amazing-grace")
        expect(hymns[0].title).toBe("Amazing Grace")
        expect(findHymn("Amazing Grace")).toBe(hymns[0])
        expect(findHymn("amazing-grace")).toBe(hymns[0])
        expect(findHymn("  AMAZING GRACE  ")).toBe(hymns[0])
        expect(findHymn("no such hymn")).toBeNull()
        expect(findHymn("")).toBeNull()
    })

    it("ships exactly the twelve starter set hymns, all unique, PD, and published by 1930", () => {
        const hymns = loadCatalog()
        expect(hymns).toHaveLength(12)
        expect(hymns.map((hymn) => hymn.id)).toEqual(STARTER_SET_IDS)
        expect(new Set(hymns.map((hymn) => hymn.id)).size).toBe(hymns.length)
        for (const hymn of hymns) {
            expect(validateHymn(hymn)).toEqual([])
            expect(hymn.license).toBe("PD")
            expect(hymn.yearPublished).toBeLessThanOrEqual(PD_CUTOFF_YEAR)
        }
    })

    it("finds every starter set hymn by its title", () => {
        for (const hymn of loadCatalog()) {
            expect(findHymn(hymn.title)).toBe(hymn)
        }
    })

    it("treats the shipped catalog as complete", () => {
        expect(assertCatalogComplete(loadCatalog())).toEqual([])
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

    it("rejects a valid hymn with a non-PD license or a year after the cutoff", () => {
        const notPublicDomain = { ...amazingGrace, license: "larry-holder" } as any
        expect(validateHymn(notPublicDomain)).not.toEqual([])
        const publishedTooLate = { ...amazingGrace, yearPublished: 1931 } as any
        expect(validateHymn(publishedTooLate)).not.toEqual([])
    })

    it("rejects duplicate ids and duplicate titles", () => {
        expect(assertCatalogComplete([amazingGrace, { ...amazingGrace }])).not.toEqual([])
        expect(assertCatalogComplete([amazingGrace, broken({ id: "amazing-grace-copy" })])).not.toEqual([])
        expect(assertCatalogComplete([amazingGrace, broken({ id: "amazing-grace-copy", title: "  amazing grace " })])).not.toEqual([])
        expect(assertCatalogComplete([amazingGrace, broken({ id: "another-hymn", title: "Something Else" })])).toEqual([])
    })

    it("lists every catalog title in the Title column of HYMNS.md", () => {
        const titles = hymnsMdTitles()
        for (const hymn of loadCatalog()) {
            expect(titles).toContain(hymn.title)
        }
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
