import { describe, expect, it } from "vitest"
import type { Show } from "../../../types/Show"
import { faithCovenantSunday, toStored } from "./model"
import { appendPart, applyServiceSequence, arrangementName, ensureChurchGroups, groupBinding, layoutForOrder, nextAfterJump, nextHint, orderTitles, partShortcut, readLayoutOrder, saveAsNewArrangement, skipPart, songChoices } from "./arrangement"

function librarySong(): Show {
    const slide = (group: string, text: string) => ({
        group,
        globalGroup: group,
        color: null,
        settings: {},
        notes: "",
        items: [{ type: "text" as const, style: "", lines: [{ align: "", text: [{ value: text, style: "" }] }] }]
    })
    return {
        name: "Amazing Grace",
        origin: "",
        category: null,
        settings: { activeLayout: "default", template: null },
        timestamps: { created: 1, modified: null, used: null },
        meta: {},
        slides: {
            "verse-1": slide("verse", "First verse"),
            chorus: slide("chorus", "Sing the chorus"),
            "verse-2": slide("verse", "Second verse"),
            bridge: slide("bridge", "The bridge"),
            tag: slide("tag", "The tag")
        },
        layouts: {
            default: { name: "Default", notes: "", slides: [{ id: "verse-1" }, { id: "chorus" }, { id: "verse-2" }, { id: "chorus" }, { id: "bridge" }] }
        },
        media: {}
    }
}

const ORDER = ["verse-1", "chorus", "verse-2", "chorus", "bridge", "chorus", "tag"]

describe("this Sunday's song order", () => {
    it("leaves the library layout unchanged", () => {
        const library = librarySong()
        const before = structuredClone(library)
        const sunday = applyServiceSequence(library, ORDER)
        expect(library).toEqual(before)
        expect(readLayoutOrder(sunday)).toEqual(ORDER)
        expect(readLayoutOrder(library, "default")).toEqual(["verse-1", "chorus", "verse-2", "chorus", "bridge"])
    })

    it("adds a tag as another reference to the same slide", () => {
        const library = librarySong()
        const order = appendPart(readLayoutOrder(library, "default"), "tag")
        const sunday = applyServiceSequence(library, order)
        expect(order.filter((id) => id === "tag")).toEqual(["tag"])
        expect(sunday.slides.tag.items).toEqual(library.slides.tag.items)
        expect(Object.keys(sunday.slides).filter((id) => id.includes("tag"))).toEqual(["tag"])
        expect(sunday.slides.tag).not.toBe(library.slides.tag)
    })

    it("continues with the next part after a jump", () => {
        const labels = { "verse-1": "verse", chorus: "chorus", "verse-2": "verse", bridge: "bridge", tag: "tag" }
        expect(nextAfterJump(ORDER, labels, 4)).toEqual({ index: 5, title: "Chorus (again)" })
        expect(nextAfterJump(ORDER, labels, ORDER.length - 1)).toBeNull()
        expect(nextHint(true, null, "Verse 1")).toBe("Next: end of song")
        expect(nextHint(false, null, "Verse 1")).toBe("Next: Verse 1")
    })

    it("keeps verse numbers on the slide when a later verse is skipped", () => {
        const labels = { "verse-1": "verse", chorus: "chorus", "verse-2": "verse", bridge: "bridge", tag: "tag" }
        const titles = orderTitles(ORDER, labels, Object.keys(labels))
        expect(titles[0]).toBe("Verse 1")
        expect(titles[1]).toBe("Chorus")
        expect(titles[2]).toBe("Verse 2")
        expect(titles[3]).toBe("Chorus (again)")
        const skipped = skipPart(ORDER, 2)
        expect(orderTitles(skipped, labels, Object.keys(labels))[0]).toBe("Verse 1")
    })

    it("writes house slides with the hidden group and the words only", () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        const welcome = stored.shows[`${stored.projectId}--welcome`].slides["welcome-slide"]
        const announcements = stored.shows[`${stored.projectId}--announcements`].slides["announce-1"]
        expect(welcome.group).toBe(".")
        expect(announcements.group).toBe(".")
        expect(welcome.items?.[0].lines?.map((line) => line.text?.map((part) => part.value).join(""))).toEqual(["Welcome"])
        expect(announcements.items?.[0].lines?.map((line) => line.text?.map((part) => part.value).join(""))).toEqual(["Announcements"])
    })
})

describe("FreeShow group and layout wrappers", () => {
    it("keeps the verse, chorus, bridge, and tag shorthand", () => {
        expect(partShortcut("verse")).toBe("V")
        expect(partShortcut("chorus")).toBe("C")
        expect(partShortcut("bridge")).toBe("B")
        expect(partShortcut("tag")).toBe("T")
        expect(partShortcut("Offering")).toBe("O")
        expect(groupBinding("chorus")).toEqual({ group: "chorus", globalGroup: "chorus", shortcut: "C" })
        expect(groupBinding("Offering").globalGroup).toBeUndefined()
    })

    it("gives the tag group the T key when FreeShow stored none", () => {
        const groups = { verse: { name: "verse", shortcut: "V" }, tag: { name: "tag", color: "#7525f5" } }
        const next = ensureChurchGroups(groups)
        expect(next.tag.shortcut).toBe("T")
        expect(ensureChurchGroups(next)).toBe(next)
        expect(groups.tag.shortcut).toBeUndefined()
        expect(ensureChurchGroups({ tag: { name: "tag", shortcut: "X" } }).tag.shortcut).toBe("X")
    })

    it("fills T only when the tag group has no shortcut property at all", () => {
        expect(ensureChurchGroups({ tag: { name: "tag" } }).tag.shortcut).toBe("T")
        expect(ensureChurchGroups({ tag: { name: "tag", shortcut: "" } }).tag.shortcut).toBe("")
        expect(ensureChurchGroups({ tag: { name: "tag", shortcut: "X" } }).tag.shortcut).toBe("X")
        const groups = { verse: { name: "verse", shortcut: "V" } }
        expect(ensureChurchGroups(groups)).toBe(groups)
    })

    it("keeps a layout slide's background and other settings when the order changes", () => {
        const existing = [
            { id: "verse-1", disabled: true, background: "bg1", color: "#111" },
            { id: "chorus", nextTimer: 12, actions: { nextAfterMedia: true }, background: "bg2", overlays: ["amen"] }
        ]
        const next = layoutForOrder(existing, ["chorus", "verse-1", "chorus"])
        expect(next[0]).toEqual(existing[1])
        expect(next[1]).toEqual(existing[0])
        expect(next[2]).toEqual({ ...existing[1], id: "chorus" })
    })

    it("names a saved arrangement by the service date and does not overwrite", () => {
        expect(arrangementName("2026-11-22", [])).toBe("Sunday Nov 22")
        expect(arrangementName("2026-11-22", ["Sunday Nov 22"])).toBe("Sunday Nov 22 2")
        expect(arrangementName("2026-11-22", ["Sunday Nov 22", "Sunday Nov 22 2"])).toBe("Sunday Nov 22 3")
    })

    it("searches songs only and returns a handful", () => {
        const library = [{ id: "amazing-grace", name: "Amazing Grace", category: "song" }, { id: "sunday-song", name: "Amazing Sunday", origin: "church-service", category: "song" }, { id: "deck", name: "Amazing Slides", category: "presentation" }, ...Array.from({ length: 100 }, (_, index) => ({ id: `notes-${index}`, name: `Notes ${index}`, category: "presentation" }))]
        expect(songChoices(library, "current", "")).toEqual([])
        expect(songChoices(library, "current", "Amazing")).toEqual([{ id: "amazing-grace", name: "Amazing Grace", category: "song" }])
        const many = Array.from({ length: 20 }, (_, index) => ({ id: `hymn-${index}`, name: `Hymn ${index}`, category: "song" }))
        expect(songChoices(many, "current", "Hymn")).toHaveLength(5)
    })

    it("ranks exact matches before starts-with and contains", () => {
        const library = [
            { id: "hymn-101", name: "Hymn 101", category: "song" },
            { id: "hymn", name: "Hymn", category: "song" },
            { id: "hymn-2", name: "Hymn 2", category: "song" },
            { id: "old-hymnal", name: "Old Hymnal", category: "song" },
            { id: "hymn-1", name: "Hymn 1", category: "song" }
        ]
        expect(songChoices(library, "current", "Hymn", 10).map((song) => song.name)).toEqual(["Hymn", "Hymn 1", "Hymn 2", "Hymn 101", "Old Hymnal"])
    })

    it("sorts each rank in natural number order", () => {
        const library = [
            { id: "hymn-10", name: "Hymn 10", category: "song" },
            { id: "hymn-2", name: "Hymn 2", category: "song" },
            { id: "hymn-1", name: "Hymn 1", category: "song" }
        ]
        expect(songChoices(library, "current", "Hymn", 10).map((song) => song.name)).toEqual(["Hymn 1", "Hymn 2", "Hymn 10"])
    })

    it("matches and sorts without regard to case", () => {
        const library = [
            { id: "lower", name: "hymn 2", category: "song" },
            { id: "upper", name: "HYMN 10", category: "song" },
            { id: "exact", name: "HYMN", category: "song" },
            { id: "title", name: "Hymn 1", category: "song" }
        ]
        expect(songChoices(library, "current", "hymn", 10).map((song) => song.name)).toEqual(["HYMN", "Hymn 1", "hymn 2", "HYMN 10"])
    })

    it("applies the limit after ranking and sorting", () => {
        const library = [
            { id: "contains-1", name: "Old Hymnal", category: "song" },
            { id: "contains-2", name: "Even Older Hymnal", category: "song" },
            { id: "starts", name: "Hymn 10", category: "song" },
            { id: "exact", name: "Hymn", category: "song" }
        ]
        expect(songChoices(library, "current", "hymn", 2).map((song) => song.id)).toEqual(["exact", "starts"])
    })

    it("reads and stores an arrangement as layout slide ids", () => {
        const library = librarySong()
        const saved = saveAsNewArrangement(library, "This Sunday", ORDER)
        expect(readLayoutOrder(library, "default")).toEqual(["verse-1", "chorus", "verse-2", "chorus", "bridge"])
        expect(readLayoutOrder(saved, "this-sunday")).toEqual(ORDER)
        expect(saved.layouts["this-sunday"].name).toBe("This Sunday")
        const skipped = skipPart(ORDER, 0)
        expect(readLayoutOrder(applyServiceSequence(saved, skipped))).toEqual(skipped)
    })
})
