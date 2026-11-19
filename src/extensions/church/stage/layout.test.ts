import { describe, expect, it } from "vitest"
import { CHURCH_STAGE_ID, CHURCH_STAGE_NAME, churchStageLayout, ensureChurchStageLayout, readStageToggles, setStageToggles } from "./layout"

const TYPE_WORDS = ["slide", "notes", "clock", "timer"]

describe("the default stage layout", () => {
    it("is saved under the church confidence id with a plain name", () => {
        expect(CHURCH_STAGE_ID).toBe("church_confidence")
        expect(CHURCH_STAGE_NAME).toBe("Stage (Sunday)")
        const layout = churchStageLayout()
        expect(layout.name).toBe(CHURCH_STAGE_NAME)
        expect(layout.disabled).toBe(false)
        expect(layout.password).toBe("")
        expect(layout.settings).toEqual({ background: true, color: "#000000", labels: false })
        expect(layout.settings.resolution).toBeUndefined()
    })

    it("shows the current words, part label, next words, next item, and clock, all on", () => {
        const layout = churchStageLayout()
        const current = layout.items.currentText
        expect(current.type).toBe("slide_text")
        expect(current.enabled).toBe(true)
        expect(current.slideOffset).toBeUndefined()
        expect(current.chords?.enabled).toBe(false)

        const partLabel = layout.items.partLabel
        expect(partLabel.type).toBe("text")
        expect(partLabel.enabled).toBe(true)
        expect(partLabel.lines?.[0]?.text?.map((part) => part.value).join("")).toBe("{slide_group}")

        const next = layout.items.nextText
        expect(next.type).toBe("slide_text")
        expect(next.enabled).toBe(true)
        expect(next.slideOffset).toBe(1)
        expect(next.lineCount).toBe(2)

        const nextItem = layout.items.nextItem
        expect(nextItem.type).toBe("text")
        expect(nextItem.enabled).toBe(true)
        expect(nextItem.lines?.[0]?.text?.map((part) => part.value).join("")).toBe("Next: {show_name+1}")

        const clock = layout.items.clock
        expect(clock.type).toBe("clock")
        expect(clock.enabled).toBe(true)
        expect(clock.clock).toEqual({ type: "digital", seconds: false })
    })

    it("keeps the notes and the stage message hidden by default", () => {
        const layout = churchStageLayout()
        expect(layout.items.notes.type).toBe("slide_notes")
        expect(layout.items.notes.enabled).toBe(false)
        expect(layout.items.stageMessage.type).toBe("text")
        expect(layout.items.stageMessage.enabled).toBe(false)
        expect(layout.items.stageMessage.lines?.[0]?.text?.[0]?.value).toBe("")
    })

    it("only lets an id say slide, notes, clock, or timer when the item is that kind", () => {
        const layout = churchStageLayout()
        for (const [id, item] of Object.entries(layout.items)) {
            for (const word of TYPE_WORDS.filter((word) => id.toLowerCase().includes(word))) {
                expect(item.type, `id "${id}" says "${word}"`).toContain(word)
            }
        }
    })

    it("lists every item exactly once in itemOrder", () => {
        const layout = churchStageLayout()
        const order = layout.itemOrder ?? []
        expect(order).toEqual(["currentText", "partLabel", "nextText", "nextItem", "clock", "notes", "stageMessage"])
        expect(order).toHaveLength(new Set(order).size)
        expect(Object.keys(layout.items).sort()).toEqual([...order].sort())
    })

    it("returns a fresh layout on every call", () => {
        const first = churchStageLayout()
        const second = churchStageLayout()
        expect(first).not.toBe(second)
        expect(first.items).not.toBe(second.items)
        first.items.notes.enabled = true
        first.settings.color = "#123456"
        expect(second.items.notes.enabled).toBe(false)
        expect(second.settings.color).toBe("#000000")
    })
})

describe("adding the church stage to a stage list", () => {
    it("adds the church stage to an empty list", () => {
        const next = ensureChurchStageLayout({})
        expect(Object.keys(next)).toEqual([CHURCH_STAGE_ID])
        expect(next[CHURCH_STAGE_ID]).toEqual(churchStageLayout())
    })

    it("adds the church stage and keeps the other stages", () => {
        const other = { name: "Main", settings: { background: false }, items: {} }
        const next = ensureChurchStageLayout({ default: other })
        expect(next.default).toBe(other)
        expect(next[CHURCH_STAGE_ID]).toEqual(churchStageLayout())
    })

    it("returns the same list when the church stage is already there", () => {
        const layouts = { [CHURCH_STAGE_ID]: churchStageLayout() }
        expect(ensureChurchStageLayout(layouts)).toBe(layouts)
    })

    it("returns the same list when the church has edited its stage", () => {
        const edited = churchStageLayout()
        edited.name = "Our Sunday stage"
        edited.settings.color = "#123456"
        const layouts = { [CHURCH_STAGE_ID]: edited }
        const next = ensureChurchStageLayout(layouts)
        expect(next).toBe(layouts)
        expect(next[CHURCH_STAGE_ID].name).toBe("Our Sunday stage")
        expect(next[CHURCH_STAGE_ID].settings.color).toBe("#123456")
    })

    it("treats a missing list as empty", () => {
        expect(Object.keys(ensureChurchStageLayout(undefined))).toEqual([CHURCH_STAGE_ID])
        expect(Object.keys(ensureChurchStageLayout(null))).toEqual([CHURCH_STAGE_ID])
    })
})

describe("reading the stage switches", () => {
    it("reads the default layout as all off with an empty message", () => {
        expect(readStageToggles(churchStageLayout())).toEqual({ notes: false, chords: false, message: false, messageText: "" })
    })

    it("reads the switches and message words a layout has set", () => {
        const layout = setStageToggles(churchStageLayout(), { notes: true, chords: true, message: true, messageText: "Please stay seated" })
        expect(readStageToggles(layout)).toEqual({ notes: true, chords: true, message: true, messageText: "Please stay seated" })
    })

    it("reads a removed item as off", () => {
        const layout = churchStageLayout()
        delete layout.items.notes
        delete layout.items.stageMessage
        expect(readStageToggles(layout)).toEqual({ notes: false, chords: false, message: false, messageText: "" })
    })
})

describe("setting the stage switches", () => {
    it("turns each switch on and off", () => {
        const on = setStageToggles(churchStageLayout(), { notes: true, chords: true, message: true, messageText: "Welcome" })
        expect(on.items.notes.enabled).toBe(true)
        expect(on.items.currentText.chords?.enabled).toBe(true)
        expect(on.items.stageMessage.enabled).toBe(true)
        expect(on.items.stageMessage.lines?.[0]?.text?.[0]?.value).toBe("Welcome")

        const off = setStageToggles(on, { notes: false, chords: false, message: false, messageText: "" })
        expect(off.items.notes.enabled).toBe(false)
        expect(off.items.currentText.chords?.enabled).toBe(false)
        expect(off.items.stageMessage.enabled).toBe(false)
        expect(off.items.stageMessage.lines?.[0]?.text?.[0]?.value).toBe("")
    })

    it("keeps the chord color and size when only the chord switch changes", () => {
        const layout = churchStageLayout()
        layout.items.currentText.chords = { enabled: false, color: "#ffd54a", size: 130 }
        const next = setStageToggles(layout, { chords: true })
        expect(next.items.currentText.chords).toEqual({ enabled: true, color: "#ffd54a", size: 130 })
    })

    it("adds the chord switch when the layout has no chord settings yet", () => {
        const layout = churchStageLayout()
        delete layout.items.currentText.chords
        const next = setStageToggles(layout, { chords: true })
        expect(next.items.currentText.chords).toEqual({ enabled: true })
    })

    it("only changes the switches it is told to", () => {
        const layout = churchStageLayout()
        const next = setStageToggles(layout, { notes: true })
        expect(next).not.toBe(layout)
        expect(next.items.notes.enabled).toBe(true)
        expect(next.items.currentText).toEqual(layout.items.currentText)
        expect(next.items.nextText).toEqual(layout.items.nextText)
        expect(next.items.stageMessage).toEqual(layout.items.stageMessage)
        expect(next.settings).toEqual(layout.settings)
        expect(next.itemOrder).toEqual(layout.itemOrder)
    })

    it("does not touch the layout it was given", () => {
        const layout = churchStageLayout()
        const before = structuredClone(layout)
        setStageToggles(layout, { notes: true, chords: true, message: true, messageText: "Hi" })
        expect(layout).toEqual(before)
    })

    it("creates the message line and text when the layout has none", () => {
        const noLines = churchStageLayout()
        delete noLines.items.stageMessage.lines
        expect(setStageToggles(noLines, { messageText: "Blessings" }).items.stageMessage.lines).toEqual([{ align: "", text: [{ value: "Blessings", style: "" }] }])

        const noText = churchStageLayout()
        noText.items.stageMessage.lines = [{ align: "", text: [] }]
        expect(setStageToggles(noText, { messageText: "Blessings" }).items.stageMessage.lines).toEqual([{ align: "", text: [{ value: "Blessings", style: "" }] }])
    })

    it("skips a switch whose item the church has removed", () => {
        const layout = churchStageLayout()
        delete layout.items.notes
        delete layout.items.stageMessage
        const next = setStageToggles(layout, { notes: true, chords: true, message: true, messageText: "Hi" })
        expect(next.items.notes).toBeUndefined()
        expect(next.items.stageMessage).toBeUndefined()
        expect(next.items.currentText.chords?.enabled).toBe(true)
        expect(next.items.currentText.enabled).toBe(true)
    })
})
