import type { Item, Show, Slide } from "../../../types/Show"
import { groupBinding } from "../service/arrangement"
import { DEFAULT_ITEM_STYLE, SONG_GROUP_FIELDS, SONG_PART_LABELS } from "../service/model"
import type { SongPartLabel } from "../service/model"
import { detectPartLabel, extractCredits, proposeTitle } from "./labels"

/**
 * Pasted-lyrics draft and show builder for the assisted importer (P0-08 s2).
 * Pure TypeScript: pasted text in, a reviewable draft and a FreeShow show out.
 * No stores, no UI.
 */

/** One section of a pasted song. `label` is a FreeShow group id (verse, chorus, ...) or a custom label; `text` has the label and credit lines removed; `repeat` is 1 unless the paste said so. */
export interface DraftPart {
    id: string
    label: string
    text: string
    repeat: number
}

/** A reviewable draft of a pasted song: a title, its parts in order, and any credits found. */
export interface SongDraft {
    title: string
    parts: DraftPart[]
    ccli?: string
    author?: string
    copyright?: string
    publicDomain?: boolean
}

/** The draft for pasted lyrics: credits out, sections into parts, a title, and stable part ids. */
export function parsePastedText(text: string, fileName?: string): SongDraft {
    const lines = normalizeLines(text)
    const { credits, creditIndexes } = extractCredits(lines)
    const creditSet = new Set(creditIndexes)
    const lyricText = lines
        .filter((_, index) => !creditSet.has(index))
        .join("\n")
        .trim()

    const sections = splitBlocks(lyricText).map((block) => parseSection(block.split("\n")))
    const anyLabeled = sections.some((section) => section.label !== null)
    const rawParts: { label: string; text: string; repeat: number }[] = anyLabeled ? sections.filter((section) => section.text).map((section) => ({ label: section.label || "verse", text: section.text, repeat: section.repeat })) : singleUnlabeledPart(lyricText)

    const title = proposeTitle(lyricText, fileName)
    const parts: DraftPart[] = []
    for (const part of rawParts) {
        let partText = part.text
        if (!parts.length) {
            const firstLine = partText
                .split("\n")
                .map((line) => line.trim())
                .find((line) => line)
            if (firstLine && titleFromLine(firstLine) === title) {
                const rest = partText.split("\n")
                rest.splice(
                    rest.findIndex((line) => line.trim() === firstLine),
                    1
                )
                partText = rest.join("\n").trim()
            }
        }
        if (!partText) continue
        parts.push({ id: `part-${parts.length + 1}`, label: part.label, text: partText, repeat: part.repeat })
    }
    return { title, parts, ...credits }
}

/** \r\n and \r become \n, and trailing blank lines go away. */
function normalizeLines(text: string): string[] {
    const lines = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    return lines
}

/** The blocks of a text, split on one or more blank lines. */
function splitBlocks(text: string): string[] {
    return (text || "")
        .split(/\n(?:[ \t]*\n)+/)
        .map((block) => block.trim())
        .filter(Boolean)
}

/** One block: its part label (when the first line is one), a trailing "xN" repeat line, and the rest as text. */
function parseSection(lines: string[]): { label: string | null; text: string; repeat: number } {
    let label: string | null = null
    let body = lines
    if (lines.length) {
        const detected = detectPartLabel(lines[0])
        if (detected) {
            label = detected
            body = lines.slice(1)
        }
    }
    let repeat = 1
    if (body.length) {
        const match = /^[xX]([1-9])$/.exec(body[body.length - 1].trim())
        if (match) {
            repeat = Number(match[1])
            body = body.slice(0, -1)
        }
    }
    return { label, text: body.join("\n").trim(), repeat }
}

/** An unlabeled paste is one verse part; its text keeps the blank lines so draftToShow can split it into slides. */
function singleUnlabeledPart(lyricText: string): { label: string; text: string; repeat: number }[] {
    const whole = parseSection(lyricText.split("\n"))
    return whole.text ? [{ label: "verse", text: whole.text, repeat: whole.repeat }] : []
}

/** The same title cleanup as labels.ts, so a title line is recognised when it is removed from the part text. */
function titleFromLine(raw: string): string {
    let name = raw
        .trim()
        .replace(/[.,!]+$/, "")
        .trim()
    if (name.length > 38) {
        const space = name.lastIndexOf(" ", 29)
        name = space > 0 ? name.slice(0, space) : name.slice(0, 30)
    }
    return name
}

/** The play order for a draft: each part in order, a repeated part as many times as it says. */
export function defaultArrangement(draft: SongDraft): string[] {
    const order: string[] = []
    for (const part of draft.parts) {
        const times = part.repeat > 0 ? Math.round(part.repeat) : 1
        for (let i = 0; i < times; i++) order.push(part.id)
    }
    return order
}

/** The FreeShow library show for a draft: parts as slides, the default arrangement as the layout. The draft is not changed. */
export function draftToShow(draft: SongDraft): Show {
    const slides: Show["slides"] = {}
    for (const part of draft.parts) {
        const binding = groupBinding(part.label)
        const known = (SONG_PART_LABELS as readonly string[]).includes(part.label) ? (part.label as SongPartLabel) : null
        const blocks = splitBlocks(part.text)
        const first = blocks[0] || ""
        const parent: Slide = {
            group: binding.group,
            globalGroup: binding.globalGroup,
            color: known ? SONG_GROUP_FIELDS[known].color : null,
            settings: {},
            notes: "",
            items: [textItem(first)]
        }
        if (blocks.length > 1) {
            parent.children = blocks.slice(1).map((block, index) => {
                const id = `${part.id}-child-${index + 1}`
                slides[id] = { group: null, color: null, settings: {}, notes: "", items: [textItem(block)] }
                return id
            })
        }
        slides[part.id] = parent
    }

    const meta: Show["meta"] = { title: draft.title }
    if (draft.author) meta.author = draft.author
    if (draft.ccli) meta.CCLI = draft.ccli
    if (draft.copyright) meta.copyright = draft.copyright

    return {
        name: draft.title,
        origin: "",
        category: "song",
        settings: { activeLayout: "arrangement", template: null },
        timestamps: { created: 0, modified: null, used: null },
        meta,
        slides,
        layouts: { arrangement: { name: "Arrangement", notes: "", slides: defaultArrangement(draft).map((id) => ({ id })) } },
        media: {}
    }
}

/** One house text item in the usual box, one line per text line. */
function textItem(block: string): Item {
    return {
        type: "text",
        style: DEFAULT_ITEM_STYLE,
        lines: block.split("\n").map((value) => ({ align: "", text: [{ value, style: "" }] }))
    }
}
