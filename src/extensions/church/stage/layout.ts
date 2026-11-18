import type { StageItem, StageLayout } from "../../../types/Stage"

/** The id this stage layout is saved under in FreeShow. */
export const CHURCH_STAGE_ID = "church_confidence"

/** The name FreeShow shows for this stage in its stage list. */
export const CHURCH_STAGE_NAME = "Stage (Sunday)"

/** The default stage display for Sunday: current words, part label, next words and item, clock, notes, and a stage message. Every call returns a fresh layout. */
export function churchStageLayout(): StageLayout {
    return {
        name: CHURCH_STAGE_NAME,
        disabled: false,
        password: "",
        settings: {
            background: true,
            color: "#000000",
            labels: false
        },
        items: {
            currentText: {
                type: "slide_text",
                enabled: true,
                chords: { enabled: false },
                style: "width:1880px;height:640px;left:20px;top:120px;font-family:Arial;font-weight:bold;color:#ffffff;font-size:110px;",
                align: ""
            },
            partLabel: {
                type: "text",
                enabled: true,
                style: "width:900px;height:100px;left:20px;top:10px;font-family:Arial;font-weight:bold;color:#ffd54a;font-size:70px;",
                align: "align-items:flex-start;",
                alignX: "left",
                lines: [{ align: "text-align:left;", text: [{ value: "{slide_group}", style: "" }] }]
            },
            nextText: {
                type: "slide_text",
                enabled: true,
                slideOffset: 1,
                lineCount: 2,
                style: "width:1880px;height:220px;left:20px;top:780px;font-family:Arial;font-weight:bold;color:#aaaaaa;font-size:70px;",
                align: ""
            },
            nextItem: {
                type: "text",
                enabled: true,
                style: "width:1300px;height:70px;left:20px;top:1005px;font-family:Arial;color:#aaaaaa;font-size:50px;",
                align: "",
                alignX: "left",
                lines: [{ align: "text-align:left;", text: [{ value: "Next: {show_name+1}", style: "" }] }]
            },
            clock: {
                type: "clock",
                enabled: true,
                clock: { type: "digital", seconds: false },
                style: "width:560px;height:100px;left:1340px;top:10px;font-family:Arial;font-weight:bold;color:#ffffff;font-size:80px;",
                align: ""
            },
            notes: {
                type: "slide_notes",
                enabled: false,
                style: "width:560px;height:300px;left:1340px;top:700px;font-family:Arial;color:#ffffff;font-size:40px;",
                align: ""
            },
            stageMessage: {
                type: "text",
                enabled: false,
                style: "width:1880px;height:120px;left:20px;top:950px;font-family:Arial;font-weight:bold;color:#000000;background-color:#ffd54a;font-size:70px;",
                align: "",
                lines: [{ align: "", text: [{ value: "", style: "" }] }]
            }
        },
        itemOrder: ["currentText", "partLabel", "nextText", "nextItem", "clock", "notes", "stageMessage"]
    }
}

/** The stage extras the operator can switch on and off. */
export interface StageToggles {
    notes?: boolean
    chords?: boolean
    message?: boolean
    messageText?: string
}

/** Reads the notes, chords, and message switches from a stage layout. */
export function readStageToggles(layout: StageLayout): Required<StageToggles> {
    const message = layout.items.stageMessage
    return {
        notes: layout.items.notes?.enabled === true,
        chords: layout.items.currentText?.chords?.enabled === true,
        message: message?.enabled === true,
        messageText: message?.lines?.[0]?.text?.[0]?.value ?? ""
    }
}

/** Returns a new stage layout with the given switches changed. The input is not touched, and a switch for an item the church removed is skipped. */
export function setStageToggles(layout: StageLayout, toggles: StageToggles): StageLayout {
    const next = structuredClone(layout)
    if (toggles.notes !== undefined && next.items.notes) next.items.notes.enabled = toggles.notes
    if (toggles.chords !== undefined && next.items.currentText) {
        next.items.currentText.chords = { ...(next.items.currentText.chords || {}), enabled: toggles.chords }
    }
    const message = next.items.stageMessage
    if (message) {
        if (toggles.message !== undefined) message.enabled = toggles.message
        if (toggles.messageText !== undefined) setMessageText(message, toggles.messageText)
    }
    return next
}

/** Puts `value` in the first text part of the item, creating the line and text if the layout has none. */
function setMessageText(item: StageItem, value: string): void {
    if (!item.lines || item.lines.length === 0) item.lines = [{ align: "", text: [{ value: "", style: "" }] }]
    const line = item.lines[0]
    if (!line.text || line.text.length === 0) line.text = [{ value: "", style: "" }]
    line.text[0].value = value
}
