import type { Show, Slide, SlideData } from "../../../types/Show"

/**
 * Thin wrappers around FreeShow groups and layouts.
 * A Sunday order is a list of part ids. Repeating a part repeats the id,
 * so the lyric slide stays a single object.
 */

export const PART_SHORTCUTS: { [label: string]: string } = {
    verse: "V",
    chorus: "C",
    bridge: "B",
    tag: "T"
}

export interface GroupRecord {
    name?: string
    shortcut?: string
    color?: string
    default?: boolean
}

/** FreeShow's group record. Tag gets T when the saved groups never set a shortcut. */
export function ensureChurchGroups<T extends { [id: string]: GroupRecord }>(groups: T): T {
    const tag = groups.tag
    if (!tag || tag.shortcut) return groups
    return { ...groups, tag: { ...tag, shortcut: PART_SHORTCUTS.tag } }
}

/** The shorthand key for a part. Known labels use V, C, B, and T. A custom label uses its first letter. */
export function partShortcut(label: string): string {
    const known = PART_SHORTCUTS[label.trim().toLowerCase()]
    if (known) return known
    const letter = label.trim().charAt(0)
    return letter ? letter.toUpperCase() : ""
}

/** globalGroup plus the shortcut FreeShow already uses for the verse bar. */
export function groupBinding(label: string): { group: string; globalGroup?: string; shortcut: string } {
    const known = PART_SHORTCUTS[label.trim().toLowerCase()] ? label.trim().toLowerCase() : ""
    return {
        group: known || label.trim(),
        globalGroup: known || undefined,
        shortcut: partShortcut(label)
    }
}

export function readLayoutOrder(show: Pick<Show, "layouts" | "settings"> | null | undefined, layoutId = ""): string[] {
    const layouts = show?.layouts || {}
    const id = layoutId || show?.settings?.activeLayout || Object.keys(layouts)[0] || ""
    return (layouts[id]?.slides || []).map((slide) => slide.id)
}

/** A new show whose layout is `order`. The input show is not changed. Repeated ids share one slide. */
export function applyServiceSequence(library: Show, order: string[]): Show {
    const copy = structuredClone(library)
    const layoutId = copy.settings?.activeLayout || "arrangement"
    const current = copy.layouts?.[layoutId] || { name: "Arrangement", notes: "", slides: [] }
    copy.layouts = {
        ...(copy.layouts || {}),
        [layoutId]: { ...current, slides: slidesForOrder(current.slides || [], order) }
    }
    if (!copy.settings) copy.settings = { activeLayout: layoutId, template: null }
    copy.settings.activeLayout = layoutId
    return copy
}

/** A new library show with an extra layout. The input show is not changed. */
export function saveAsNewArrangement(library: Show, name: string, order: string[]): Show {
    const copy = structuredClone(library)
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arrangement"
    const layoutId = copy.settings?.activeLayout || Object.keys(copy.layouts || {})[0] || ""
    const current = copy.layouts?.[layoutId]
    copy.layouts = {
        ...(copy.layouts || {}),
        [id]: { name: name.trim() || "Arrangement", notes: "", slides: slidesForOrder(current?.slides || [], order) }
    }
    return copy
}

export function layoutForOrder(existing: SlideData[], order: string[]): SlideData[] {
    return slidesForOrder(existing, order)
}

export function appendPart(order: string[], partId: string): string[] {
    return partId ? [...order, partId] : order.slice()
}

export function skipPart(order: string[], index: number): string[] {
    return order.filter((_, item) => item !== index)
}

export function movePart(order: string[], from: number, to: number): string[] {
    if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order.slice()
    const next = order.slice()
    const [part] = next.splice(from, 1)
    next.splice(to, 0, part)
    return next
}

/** "V2" is the second verse in this Sunday's order. "C" is the first chorus. */
export function jumpIndex(order: string[], labels: { [id: string]: string }, token: string): number | null {
    const match = /^([A-Za-z]+)(\d+)?$/.exec(token.trim())
    if (!match) return null
    const key = match[1].toUpperCase()
    const number = match[2] ? Number(match[2]) : 1
    const hits = order.reduce<number[]>((found, id, index) => {
        if (partShortcut(labels[id] || "") === key) found.push(index)
        return found
    }, [])
    return hits[number - 1] ?? null
}

export function partTitle(label: string, occurrence: number, total: number): string {
    const name = label ? label.charAt(0).toUpperCase() + label.slice(1) : "Slide"
    if (total < 2) return name
    return `${name} ${occurrence}`
}

/** The part Next will play after a jump to `index`. */
export function nextAfterJump(order: string[], labels: { [id: string]: string }, index: number): { index: number; title: string } | null {
    const next = index + 1
    if (next < 0 || next >= order.length) return null
    return { index: next, title: titleAt(order, labels, next) }
}

export function titleAt(order: string[], labels: { [id: string]: string }, index: number): string {
    const id = order[index]
    const label = labels[id] || "Slide"
    const same = order.filter((part) => (labels[part] || "Slide") === label)
    const occurrence = order.slice(0, index + 1).filter((part) => (labels[part] || "Slide") === label).length
    return partTitle(label, occurrence, same.length)
}

/** House slides carry the words only. A group name in capitals is not part of the text. */
export function houseSlideText(slide: Slide | undefined): string {
    const lines = (slide?.items || []).flatMap((item) => item.lines || [])
    return lines.map((line) => (line.text || []).map((part) => part.value || "").join("")).join("\n")
}

export function hasAllCapsHeading(text: string): boolean {
    return text.split("\n").some((line) => /^(VERSE|CHORUS|BRIDGE|TAG|ANNOUNCEMENT|WELCOME)$/.test(line.trim()))
}

function slidesForOrder(existing: SlideData[], order: string[]): SlideData[] {
    const timed = existing.find((slide) => slide.nextTimer != null || slide.actions)
    return order.map((id, index) => {
        const slide: SlideData = { id }
        if (index === order.length - 1 && timed) {
            if (timed.nextTimer != null) slide.nextTimer = timed.nextTimer
            if (timed.actions) slide.actions = timed.actions
        }
        return slide
    })
}
