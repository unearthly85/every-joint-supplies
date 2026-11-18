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
    const id =
        name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "arrangement"
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

/**
 * Names come from the slides in the song, not from how many times this Sunday uses them.
 * Verse 1 stays Verse 1 if Verse 2 is skipped. A repeated slide is "Chorus (again)".
 */
export function orderTitles(order: string[], labels: { [id: string]: string }, catalogIds: string[]): string[] {
    const ids = catalogIds.length ? catalogIds : Array.from(new Set(order))
    const byLabel = new Map<string, string[]>()
    for (const id of ids) {
        const label = labels[id] || "Slide"
        const list = byLabel.get(label) || []
        if (!list.includes(id)) list.push(id)
        byLabel.set(label, list)
    }
    const base = new Map<string, string>()
    for (const [label, list] of byLabel) {
        const name = label ? label.charAt(0).toUpperCase() + label.slice(1) : "Slide"
        list.forEach((id, index) => base.set(id, list.length > 1 ? `${name} ${index + 1}` : name))
    }
    const seen = new Set<string>()
    return order.map((id) => {
        const title = base.get(id) || "Slide"
        if (seen.has(id)) return `${title} (again)`
        seen.add(id)
        return title
    })
}

/** The part Next will play after a jump to `index`. Null means the song is over. */
export function nextAfterJump(order: string[], labels: { [id: string]: string }, index: number): { index: number; title: string } | null {
    const next = index + 1
    if (next < 0 || next >= order.length) return null
    return { index: next, title: orderTitles(order, labels, Object.keys(labels))[next] }
}

export function nextHint(onOutput: boolean, nextTitle: string | null, firstTitle: string | null): string {
    if (onOutput) return nextTitle ? `Next: ${nextTitle}` : "Next: end of song"
    return firstTitle ? `Next: ${firstTitle}` : "Next: —"
}

/** "Sunday Nov 22", then "Sunday Nov 22 2" when that name is already a layout. */
export function arrangementName(date: string, existingNames: string[]): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
    let base = "This Sunday"
    if (match) {
        const stamp = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
        const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(stamp)
        base = `Sunday ${day}`
    }
    if (!existingNames.includes(base)) return base
    let suffix = 2
    while (existingNames.includes(`${base} ${suffix}`)) suffix += 1
    return `${base} ${suffix}`
}

export interface SongChoice {
    id: string
    name?: string
    origin?: string
    category?: string | null
}

/** Saved songs for the picker. Presentations and this Sunday's own shows stay out. */
export function songChoices(library: SongChoice[], currentId: string, query: string, limit = 5): SongChoice[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const rank = (name: string | undefined): number => {
        const lowered = (name || "").toLowerCase()
        if (lowered === needle) return 0
        if (lowered.startsWith(needle)) return 1
        return 2
    }
    return library
        .filter((show) => {
            if (!show.name || show.id === currentId) return false
            if (show.origin === "church-service") return false
            if (show.category && show.category !== "song") return false
            return show.name.toLowerCase().includes(needle)
        })
        .sort((a, b) => {
            const diff = rank(a.name) - rank(b.name)
            if (diff) return diff
            return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })
        })
        .slice(0, limit)
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
    const copies = new Map<string, SlideData[]>()
    for (const slide of existing) {
        const list = copies.get(slide.id) || []
        list.push(slide)
        copies.set(slide.id, list)
    }
    const used = new Map<string, number>()
    return order.map((id) => {
        const list = copies.get(id) || []
        const count = used.get(id) || 0
        used.set(id, count + 1)
        const source = list[count] || list[0]
        return source ? { ...source, id } : { id }
    })
}
