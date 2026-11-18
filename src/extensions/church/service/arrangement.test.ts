import { describe, expect, it } from "vitest"
import type { Show } from "../../../types/Show"
import { faithCovenantSunday, toStored } from "./model"
import { applyServiceSequence, appendPart, ensureChurchGroups, groupBinding, hasAllCapsHeading, houseSlideText, jumpIndex, nextAfterJump, partShortcut, readLayoutOrder, saveAsNewArrangement, skipPart } from "./arrangement"

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
        const bridge = jumpIndex(ORDER, labels, "B")
        expect(bridge).toBe(4)
        expect(nextAfterJump(ORDER, labels, bridge || 0)).toEqual({ index: 5, title: "Chorus 3" })
        expect(jumpIndex(ORDER, labels, "V2")).toBe(2)
        expect(jumpIndex(ORDER, labels, "C")).toBe(1)
        expect(jumpIndex(ORDER, labels, "T")).toBe(6)
    })

    it("does not put an all-caps group heading on a house slide", () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        const welcome = stored.shows[`${stored.projectId}--welcome`]
        const announcements = stored.shows[`${stored.projectId}--announcements`]
        for (const show of [welcome, announcements]) {
            for (const slide of Object.values(show.slides)) {
                expect(hasAllCapsHeading(houseSlideText(slide))).toBe(false)
                expect(slide.group).toBe(".")
            }
        }
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
