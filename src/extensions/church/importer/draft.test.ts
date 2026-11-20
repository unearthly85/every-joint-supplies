import { describe, expect, it } from "vitest"
import { DEFAULT_ITEM_STYLE, SONG_GROUP_FIELDS } from "../service/model"
import { defaultArrangement, draftToShow, parsePastedText } from "./draft"
import type { SongDraft } from "./draft"

const PROCLAIM_STYLE = ["Made Up Hymn", "", "VERSE 1", "Line one of the first verse", "Line two of the first verse", "", "CHORUS", "Chorus line one", "Chorus line two", "", "VERSE 2", "Line one of the second verse", "Line two of the second verse", "", "CHORUS", "Chorus line one", "Chorus line two", "", "CCLI: 1234567", "© 2020 Made Up Songs"].join("\n")

const NO_LABELS = ["Song Title Here", "First block line", "", "Second block line", "Second block more", "", "Third block line", "Third block more", "", "Fourth block line", "Fourth block more"].join("\n")

const MIXED = ["Mixed Up Song", "Unlabeled first line", "", "CHORUS", "Chorus line one", "Chorus line two", "", "Unlabeled last line", "Unlabeled last more"].join("\n")

const REPEATED = ["Repeat Song", "", "VERSE 1", "Verse line one", "", "CHORUS", "Chorus line one", "x2"].join("\n")

const CUSTOM = ["Custom Song Title", "", "{My Label}", "Custom line one", "Custom line two"].join("\n")

describe("parsePastedText", () => {
    it("reads a Proclaim-style paste into a titled draft with four parts and credits", () => {
        const draft = parsePastedText(PROCLAIM_STYLE)
        expect(draft.title).toBe("Made Up Hymn")
        expect(draft.ccli).toBe("1234567")
        expect(draft.copyright).toBe("© 2020 Made Up Songs")
        expect(draft.parts.map((part) => part.id)).toEqual(["part-1", "part-2", "part-3", "part-4"])
        expect(draft.parts.map((part) => part.label)).toEqual(["verse", "chorus", "verse", "chorus"])
        expect(draft.parts[0].text).toBe("Line one of the first verse\nLine two of the first verse")
        expect(draft.parts[1].text).toBe("Chorus line one\nChorus line two")
        for (const part of draft.parts) {
            expect(part.text).not.toContain("CCLI")
            expect(part.text).not.toContain("©")
            expect(part.text).not.toContain("Made Up Hymn")
        }
        expect(defaultArrangement(draft)).toEqual(["part-1", "part-2", "part-3", "part-4"])
    })

    it("keeps an unlabeled paste as one verse part whose text keeps all blocks", () => {
        const draft = parsePastedText(NO_LABELS)
        expect(draft.title).toBe("Song Title Here")
        expect(draft.parts).toHaveLength(1)
        expect(draft.parts[0].label).toBe("verse")
        expect(draft.parts[0].text).toBe("First block line\n\nSecond block line\nSecond block more\n\nThird block line\nThird block more\n\nFourth block line\nFourth block more")
    })

    it("turns unlabeled sections into verse parts when some sections have labels", () => {
        const draft = parsePastedText(MIXED)
        expect(draft.title).toBe("Mixed Up Song")
        expect(draft.parts.map((part) => part.label)).toEqual(["verse", "chorus", "verse"])
        expect(draft.parts[0].text).toBe("Unlabeled first line")
        expect(draft.parts[2].text).toBe("Unlabeled last line\nUnlabeled last more")
    })

    it("reads a trailing x2 line as a repeat and removes it from the text", () => {
        const draft = parsePastedText(REPEATED)
        expect(draft.parts).toHaveLength(2)
        expect(draft.parts[1].label).toBe("chorus")
        expect(draft.parts[1].text).toBe("Chorus line one")
        expect(draft.parts[1].repeat).toBe(2)
        expect(defaultArrangement(draft)).toEqual(["part-1", "part-2", "part-2"])
    })

    it("keeps a Proclaim custom label as the part label", () => {
        const draft = parsePastedText(CUSTOM)
        expect(draft.parts).toHaveLength(1)
        expect(draft.parts[0].label).toBe("My Label")
        expect(draft.parts[0].text).toBe("Custom line one\nCustom line two")
    })

    it("removes a long title line from the part text and shortens the title", () => {
        const longTitle = "This Is A Rather Long Made Up Song Title"
        const draft = parsePastedText(`${longTitle}\nLine one of the verse`)
        expect(draft.title).toBe("This Is A Rather Long Made Up")
        expect(draft.parts).toHaveLength(1)
        expect(draft.parts[0].text).toBe("Line one of the verse")
    })

    it("falls back to the file name and then Untitled for the title", () => {
        expect(parsePastedText("VERSE 1", "A Pasted Song.txt").title).toBe("A Pasted Song")
        expect(parsePastedText("VERSE 1").title).toBe("Untitled")
        expect(parsePastedText("VERSE 1\nLine one").title).toBe("Line one")
    })
})

describe("draftToShow", () => {
    const draft: SongDraft = {
        title: "Show Builder Song",
        parts: [
            { id: "part-1", label: "verse", text: "Verse line one\n\nVerse line two", repeat: 1 },
            { id: "part-2", label: "chorus", text: "Chorus line one", repeat: 2 },
            { id: "part-3", label: "My Label", text: "Custom line one", repeat: 1 }
        ],
        ccli: "1234567"
    }

    it("builds part slides with groups, colours, and child slides", () => {
        const before = JSON.stringify(draft)
        const show = draftToShow(draft)
        expect(JSON.stringify(draft)).toBe(before)

        expect(show.name).toBe("Show Builder Song")
        expect(show.origin).toBe("")
        expect(show.category).toBe("song")
        expect(show.settings).toEqual({ activeLayout: "arrangement", template: null })
        expect(show.timestamps).toEqual({ created: 0, modified: null, used: null })
        expect(show.meta).toEqual({ title: "Show Builder Song", CCLI: "1234567" })
        expect(show.media).toEqual({})

        expect(Object.keys(show.slides).sort()).toEqual(["part-1", "part-1-child-1", "part-2", "part-3"])
        expect(show.slides["part-1"].group).toBe("verse")
        expect(show.slides["part-1"].globalGroup).toBe("verse")
        expect(show.slides["part-1"].color).toBe(SONG_GROUP_FIELDS.verse.color)
        expect(show.slides["part-1"].children).toEqual(["part-1-child-1"])
        expect(show.slides["part-1"].items).toEqual([{ type: "text", style: DEFAULT_ITEM_STYLE, lines: [{ align: "", text: [{ value: "Verse line one", style: "" }] }] }])
        expect(show.slides["part-1-child-1"].group).toBeNull()
        expect(show.slides["part-1-child-1"].color).toBeNull()
        expect(show.slides["part-1-child-1"].items).toEqual([{ type: "text", style: DEFAULT_ITEM_STYLE, lines: [{ align: "", text: [{ value: "Verse line two", style: "" }] }] }])

        expect(show.slides["part-2"].globalGroup).toBe("chorus")
        expect(show.slides["part-2"].color).toBe(SONG_GROUP_FIELDS.chorus.color)
        expect(show.slides["part-3"].group).toBe("My Label")
        expect(show.slides["part-3"].globalGroup).toBeUndefined()
        expect(show.slides["part-3"].color).toBeNull()
    })

    it("uses the default arrangement as the layout, with repeated ids sharing one slide", () => {
        const show = draftToShow(draft)
        expect(show.layouts.arrangement).toEqual({ name: "Arrangement", notes: "", slides: [{ id: "part-1" }, { id: "part-2" }, { id: "part-2" }, { id: "part-3" }] })
        expect(show.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(defaultArrangement(draft))
        const layoutIds = show.layouts.arrangement.slides.map((slide) => slide.id)
        expect(layoutIds.filter((id) => id === "part-2")).toHaveLength(2)
        expect(show.slides["part-2"]).toBeDefined()
        expect(Object.keys(show.slides)).toHaveLength(4)
    })

    it("builds a library show from a parsed Proclaim-style draft", () => {
        const parsed = parsePastedText(PROCLAIM_STYLE)
        const show = draftToShow(parsed)
        expect(show.name).toBe("Made Up Hymn")
        expect(show.origin).toBe("")
        expect(show.category).toBe("song")
        expect(show.meta.CCLI).toBe("1234567")
        expect(show.meta.copyright).toBe("© 2020 Made Up Songs")
        expect(Object.keys(show.slides)).toEqual(["part-1", "part-2", "part-3", "part-4"])
        expect(show.slides["part-2"].globalGroup).toBe("chorus")
        expect(show.slides["part-2"].color).toBe(SONG_GROUP_FIELDS.chorus.color)
        expect(show.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(defaultArrangement(parsed))
    })
})
