import { describe, expect, it } from "vitest"
import { amazingGrace } from "./bundle/amazing-grace"
import { loadCatalog } from "./catalog"
import { matchTitle, normalizeTitle, searchHymns, titlesOf } from "./search"
import type { HymnRecord } from "./types"
import { validateHymn } from "./validate"

/** A made-up public domain hymn that passes validateHymn, for the search tests. */
function madeUp(id: string, title: string, changes: Partial<HymnRecord> = {}): HymnRecord {
    return {
        id,
        title,
        authors: ["Made Up Author"],
        yearPublished: 1779,
        license: "PD",
        source: { hymnal: "Made Up Hymnal", year: 1779 },
        pdRationale: "Made up text for the search tests, never published.",
        parts: [{ id: "verse-1", label: "verse", text: "Made up line one" }],
        ...changes
    }
}

/** The second "grace" hymn of the ambiguous fixture. */
const riverOfGrace = madeUp("river-of-grace", "River of Grace")

describe("normalizeTitle", () => {
    it("strips punctuation and parentheses, lowercases, and collapses whitespace", () => {
        expect(normalizeTitle("Amazing Grace (How Sweet the Sound)!")).toBe("amazing grace how sweet the sound")
        expect(normalizeTitle("  AMAZING   Grace  ")).toBe("amazing grace")
        expect(normalizeTitle("It Is Well (My Soul)")).toBe("it is well my soul")
        expect(normalizeTitle("Hymn 12 (3rd ed.)")).toBe("hymn 12 3rd ed")
        expect(normalizeTitle("")).toBe("")
    })
})

describe("titlesOf", () => {
    it("lists the title, the aliases, and the first line when present, as the original strings", () => {
        expect(titlesOf(amazingGrace)).toEqual(["Amazing Grace", "Amazing Grace (How Sweet the Sound)", "Faith's Review and Expectation", "Amazing grace! how sweet the sound"])
    })

    it("omits the first line when the hymn has none", () => {
        expect(titlesOf(riverOfGrace)).toEqual(["River of Grace"])
    })
})

describe("matchTitle", () => {
    it("returns null for an empty or whitespace query", () => {
        expect(matchTitle("")).toBeNull()
        expect(matchTitle("   ")).toBeNull()
    })

    it("finds Amazing Grace by title, by id, and by its Hymnbase-style name", () => {
        expect(matchTitle("Amazing Grace")?.id).toBe("amazing-grace")
        expect(matchTitle("amazing-grace")?.id).toBe("amazing-grace")
        expect(matchTitle("Amazing Grace (How Sweet the Sound)")?.id).toBe("amazing-grace")
    })

    it("finds a hymn by an alias and by its first line", () => {
        expect(matchTitle("Faith's Review and Expectation")?.id).toBe("amazing-grace")
        expect(matchTitle("how sweet the sound")?.id).toBe("amazing-grace")
    })

    it("returns the unique starts-with hit in a one-hymn catalog", () => {
        expect(matchTitle("amazing", [amazingGrace])).toBe(amazingGrace)
    })

    it("prefers an exact title over a starts-with hit", () => {
        const plain = madeUp("grace", "Grace")
        expect(matchTitle("grace", [plain, madeUp("grace-garden", "Grace Garden")])).toBe(plain)
    })

    it("returns null when two hymns both include the query", () => {
        expect(matchTitle("grace", [amazingGrace, riverOfGrace])).toBeNull()
    })

    it("returns null when two hymns share the winning exact title", () => {
        expect(matchTitle("same name", [madeUp("same-name", "Same Name"), madeUp("other-same-name", "  SAME  Name ")])).toBeNull()
    })

    it("returns null when nothing matches", () => {
        expect(matchTitle("no such hymn", [amazingGrace])).toBeNull()
        expect(matchTitle("no such hymn")).toBeNull()
    })
})

describe("searchHymns", () => {
    it("returns nothing for an empty or whitespace query", () => {
        expect(searchHymns("")).toEqual([])
        expect(searchHymns("   ")).toEqual([])
    })

    it("finds Amazing Grace for 'Amazing' and never invents records", () => {
        const catalog = loadCatalog()
        const ids = new Set(catalog.map((hymn) => hymn.id))
        const found = searchHymns("Amazing")
        expect(found.length).toBeGreaterThan(0)
        expect(found[0].id).toBe("amazing-grace")
        for (const hymn of found) {
            expect(ids.has(hymn.id)).toBe(true)
        }
    })

    it("returns both 'grace' hymns, sorted", () => {
        expect(searchHymns("grace", [riverOfGrace, amazingGrace])).toEqual([amazingGrace, riverOfGrace])
    })

    it("ranks exact title or alias first, then title starts with the query, then the rest, ties by title", () => {
        const plain = madeUp("grace", "Grace")
        expect(searchHymns("grace", [riverOfGrace, amazingGrace, plain])).toEqual([plain, amazingGrace, riverOfGrace])
    })

    it("matches on an alias, an id, and a first line", () => {
        expect(searchHymns("faiths review", [amazingGrace]).map((hymn) => hymn.id)).toEqual(["amazing-grace"])
        expect(searchHymns("amazing-grace", [amazingGrace]).map((hymn) => hymn.id)).toEqual(["amazing-grace"])
        const withFirstLine = madeUp("made-up", "Made Up Hymn", { firstLine: "Made up line one" })
        expect(searchHymns("made up line one", [withFirstLine]).map((hymn) => hymn.id)).toEqual(["made-up"])
    })

    it("dedupes by id and respects the limit", () => {
        expect(searchHymns("amazing", [amazingGrace, { ...amazingGrace }])).toEqual([amazingGrace])
        const catalog = loadCatalog()
        expect(searchHymns("e", catalog, 3)).toHaveLength(3)
        expect(searchHymns("e", catalog)).toHaveLength(8)
    })

    it("keeps every made-up fixture valid, so the tests prove real records", () => {
        expect(validateHymn(riverOfGrace)).toEqual([])
        expect(validateHymn(madeUp("grace", "Grace"))).toEqual([])
    })
})
