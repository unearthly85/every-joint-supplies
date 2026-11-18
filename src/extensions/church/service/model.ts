import type { Project, ProjectShowRef } from "../../../types/Projects"
import type { Show, Slide, SlideData } from "../../../types/Show"

/**
 * A Sunday service stored as a FreeShow project.
 *
 * Sections are project entries of type "section", in array order. Items are the
 * entries that follow a section until the next one. Songs are shows: each part
 * is a slide whose group is verse, chorus, bridge, or tag, and the arrangement
 * (including repeats) is that show's layout slide list. Our own fields live in
 * `data.church` and on `project.church`, which the project file already saves.
 * Nothing here runs a timer. The next task owns that.
 */

export const SONG_PART_LABELS = ["verse", "chorus", "bridge", "tag"] as const
export type SongPartLabel = (typeof SONG_PART_LABELS)[number]

export const SECTION_KINDS = ["pre_service_loop", "warmup", "service", "post_service", "custom"] as const
export type SectionKind = (typeof SECTION_KINDS)[number]

export const ITEM_TYPES = ["song", "scripture", "sermon", "announcement", "video", "image", "audio"] as const
export type ItemType = (typeof ITEM_TYPES)[number]

/** Same string as FreeShow's DEFAULT_ITEM_STYLE. A generated slide uses it so text lands in the usual box. */
export const DEFAULT_ITEM_STYLE = "top:88px;left:50px;height:904px;width:1820px;"

/** Default group colours from FreeShow. globalGroup is the id, so shortcuts and colours still apply. */
export const SONG_GROUP_FIELDS: { [label in SongPartLabel]: { color: string } } = {
    verse: { color: "#5825f5" },
    chorus: { color: "#f525d2" },
    bridge: { color: "#f52598" },
    tag: { color: "#7525f5" }
}

export type TimingMode = "A" | "B"

export const CHURCH_ORIGIN = "church-service"
export const CHURCH_VERSION = 1

/** Faith Covenant's usual Sunday. Mode A: the countdown begins at the start time. */
export const FAITH_COVENANT_SUNDAY = {
    advertisedTime: "10:30:00",
    startTime: "10:27:00",
    countdownDurationSeconds: 5 * 60,
    timingMode: "A" as TimingMode
}

export interface Timeframe {
    /** Length in seconds. Not rounded to a minute. */
    durationSeconds?: number
    untilTime?: string
    onMediaEnd?: boolean
}

export interface SongPart {
    id: string
    label: SongPartLabel
    text: string
}

export interface TextPage {
    id: string
    text: string
}

export interface ServiceItem {
    id: string
    type: ItemType
    name: string
    timeframe?: Timeframe
    /** Stored explicitly. When omitted, on if a timeframe is set and off otherwise. */
    autoAdvance?: boolean
    parts?: SongPart[]
    /** Part ids. The same id may appear more than once (an ad-hoc repeat). */
    arrangement?: string[]
    scripture?: string
    slides?: TextPage[]
    mediaPath?: string
}

export interface ServiceSection {
    id: string
    kind: SectionKind
    name: string
    items: ServiceItem[]
}

export interface ChurchService {
    id: string
    name: string
    date: string
    advertisedTime: string
    startTime: string
    timingMode: TimingMode
    countdownDurationSeconds: number
    sections: ServiceSection[]
}

export interface ChurchBlob {
    version: typeof CHURCH_VERSION
    date: string
    advertisedTime: string
    startTime: string
    timingMode: TimingMode
    countdownDurationSeconds: number
}

interface SectionBlob {
    kind: SectionKind
    service: ChurchBlob
}

interface ItemBlob {
    itemId: string
    itemType: ItemType
    timeframe?: Timeframe
    autoAdvance: boolean
    scripture?: string
    slides?: TextPage[]
    mediaPath?: string
    parts?: SongPart[]
    arrangement?: string[]
}

export interface StoredProject extends Project {
    church?: ChurchBlob
}

export interface StoredService {
    projectId: string
    project: StoredProject
    shows: { [id: string]: Show }
}

/** Seconds after midnight. Accepts 24-hour times and 12-hour times such as "10:27 AM". */
export function parseClock(value: string): number {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/.exec(value.trim())
    if (!match) throw new Error("Enter a time like 10:30")
    let hours = Number(match[1])
    const minutes = Number(match[2])
    const seconds = match[3] ? Number(match[3]) : 0
    const suffix = match[4]?.toLowerCase()
    if (minutes > 59 || seconds > 59) throw new Error("Enter a time like 10:30")
    if (suffix) {
        if (hours < 1 || hours > 12) throw new Error("Enter a time like 10:30")
        hours = suffix === "am" ? hours % 12 : (hours % 12) + 12
    } else if (hours > 23) {
        throw new Error("Enter a time like 10:30")
    }
    return hours * 3600 + minutes * 60 + seconds
}

/** 24-hour HH:mm:ss. Stored times use this so seconds are not lost. */
export function canonicalClock(totalSeconds: number): string {
    const day = 24 * 60 * 60
    const wrapped = ((Math.round(totalSeconds) % day) + day) % day
    const hours = Math.floor(wrapped / 3600)
    const minutes = Math.floor((wrapped % 3600) / 60)
    const seconds = wrapped % 60
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/** Clock in the system locale. A US locale shows "10:27 AM". Seconds stay visible when they are not zero. */
export function formatClock(totalSeconds: number): string {
    const canonical = canonicalClock(totalSeconds)
    const [hours, minutes, seconds] = canonical.split(":").map(Number)
    const cycle = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle
    const showSeconds = seconds !== 0
    if (cycle === "h12" || cycle === "h11") {
        const suffix = hours < 12 ? "AM" : "PM"
        const hour12 = hours % 12 || 12
        const clock = `${hour12}:${String(minutes).padStart(2, "0")}${showSeconds ? `:${String(seconds).padStart(2, "0")}` : ""}`
        return `${clock} ${suffix}`
    }
    return showSeconds ? canonical : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/**
 * Mode A (default): the pre-service loop hands off at the start time and the
 * countdown begins then. Mode B: the countdown ends at the start time, so it
 * begins one countdown length earlier. The length is seconds, not rounded minutes.
 * Returned clocks are canonical HH:mm:ss.
 */
export function countdownWindow(mode: TimingMode, startTime: string, durationSeconds: number): { starts: string; ends: string } {
    const start = parseClock(startTime)
    const length = Math.round(durationSeconds)
    if (mode === "B") return { starts: canonicalClock(start - length), ends: canonicalClock(start) }
    return { starts: canonicalClock(start), ends: canonicalClock(start + length) }
}

export function countdownLine(service: Pick<ChurchService, "timingMode" | "startTime" | "countdownDurationSeconds">): string {
    const window = countdownWindow(service.timingMode, service.startTime, service.countdownDurationSeconds)
    return `Countdown starts ${formatClock(parseClock(window.starts))}, ends ${formatClock(parseClock(window.ends))}`
}

export function timeframeIsSet(timeframe: Timeframe | undefined): boolean {
    if (!timeframe) return false
    if (timeframe.durationSeconds != null) return true
    if (timeframe.untilTime) return true
    return timeframe.onMediaEnd === true
}

/** Auto-advance is on when a timeframe is set, unless the item says otherwise. */
export function autoAdvanceEnabled(item: Pick<ServiceItem, "autoAdvance" | "timeframe">): boolean {
    if (typeof item.autoAdvance === "boolean") return item.autoAdvance
    return timeframeIsSet(item.timeframe)
}

export interface FaithCovenantOptions {
    advertisedTime?: string
    startTime?: string
    timingMode?: TimingMode
    countdownDurationSeconds?: number
    name?: string
}

export function faithCovenantSunday(date: string, options: FaithCovenantOptions = {}): ChurchService {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Enter a service date")
    const advertisedTime = options.advertisedTime ?? FAITH_COVENANT_SUNDAY.advertisedTime
    const startTime = options.startTime ?? FAITH_COVENANT_SUNDAY.startTime
    const timingMode = options.timingMode ?? FAITH_COVENANT_SUNDAY.timingMode
    const countdownDurationSeconds = options.countdownDurationSeconds ?? FAITH_COVENANT_SUNDAY.countdownDurationSeconds
    if (timingMode !== "A" && timingMode !== "B") throw new Error("Timing mode must be A or B")
    if (countdownDurationSeconds < 0) throw new Error("Countdown length cannot be negative")
    const advertised = canonicalClock(parseClock(advertisedTime))
    const start = canonicalClock(parseClock(startTime))

    const countdown: Timeframe = { durationSeconds: countdownDurationSeconds, onMediaEnd: true }
    const id = `sunday-${date}-${start.replace(/:/g, "")}`
    const service: ChurchService = {
        id,
        name: options.name ?? `Sunday ${date}`,
        date,
        advertisedTime: advertised,
        startTime: start,
        timingMode,
        countdownDurationSeconds,
        sections: [
            {
                id: `${id}--pre-service`,
                kind: "pre_service_loop",
                name: "Pre-service",
                items: [{ id: "welcome", type: "announcement", name: "Welcome slides", slides: [{ id: "welcome-slide", text: "Welcome" }], timeframe: { untilTime: start } }]
            },
            {
                id: `${id}--countdown`,
                kind: "warmup",
                name: "Countdown",
                items: [{ id: "countdown-video", type: "video", name: "Countdown video", mediaPath: "media/countdown.mp4", timeframe: countdown }]
            },
            {
                id: `${id}--service`,
                kind: "service",
                name: "Service",
                items: [
                    { id: "announcements", type: "announcement", name: "Announcements", slides: [{ id: "announce-1", text: "Announcements" }] },
                    { id: "scripture", type: "scripture", name: "Scripture", scripture: "Psalm 100", slides: [{ id: "psalm-100", text: "Psalm 100" }] },
                    {
                        id: "song",
                        type: "song",
                        name: "Song",
                        parts: [
                            { id: "verse-1", label: "verse", text: "Verse" },
                            { id: "chorus", label: "chorus", text: "Chorus" },
                            { id: "bridge", label: "bridge", text: "Bridge" },
                            { id: "tag", label: "tag", text: "Tag" }
                        ],
                        arrangement: ["verse-1", "chorus", "verse-1", "chorus", "bridge", "chorus", "tag"]
                    }
                ]
            }
        ]
    }
    return service
}

export function toStored(service: ChurchService): StoredService {
    const blob = churchBlob(service)
    const created = Date.parse(`${service.date}T12:00:00Z`)
    const shows: { [id: string]: Show } = {}
    const refs: ProjectShowRef[] = []

    for (const section of service.sections) {
        const sectionTime = sectionClock(section.kind, service)
        refs.push({
            id: section.id,
            type: "section",
            name: section.name,
            notes: "",
            loop: section.kind === "pre_service_loop",
            data: { ...(sectionTime ? { time: sectionTime } : {}), church: { kind: section.kind, service: blob } satisfies SectionBlob }
        })
        for (const item of section.items) {
            const built = buildShow(service, item, created)
            if (built) shows[built.id] = built.show
            refs.push(itemRef(service, item, built?.id))
        }
    }

    const project: StoredProject = {
        name: service.name,
        created: Number.isNaN(created) ? 0 : created,
        parent: "/",
        origin: CHURCH_ORIGIN,
        shows: refs,
        church: blob
    }
    return { projectId: service.id, project, shows }
}

export function fromStored(stored: StoredService): ChurchService {
    const blob = readBlob(stored.project)
    const sections: ServiceSection[] = []
    let current: ServiceSection | null = null

    for (const ref of stored.project.shows || []) {
        if (ref.type === "section") {
            current = {
                id: ref.id,
                kind: sectionKind(ref),
                name: ref.name || "Section",
                items: []
            }
            sections.push(current)
            continue
        }
        if (!current) {
            current = { id: "custom", kind: "custom", name: "Service", items: [] }
            sections.push(current)
        }
        current.items.push(readItem(stored, ref))
    }

    return {
        id: stored.projectId,
        name: stored.project.name,
        date: blob.date,
        advertisedTime: blob.advertisedTime,
        startTime: blob.startTime,
        timingMode: blob.timingMode === "B" ? "B" : "A",
        countdownDurationSeconds: blob.countdownDurationSeconds,
        sections
    }
}

/**
 * FreeShow's save removes show settings, timestamps, slide.id, and the project
 * ref's layout before writing. A Sunday still has to come back intact.
 */
export function simulateFreeShowSave(stored: StoredService): StoredService {
    const copy = JSON.parse(JSON.stringify(stored)) as StoredService
    for (const show of Object.values(copy.shows)) {
        delete (show as { settings?: unknown }).settings
        delete (show as { timestamps?: unknown }).timestamps
        for (const slide of Object.values(show.slides || {})) delete slide.id
    }
    for (const ref of copy.project.shows || []) delete ref.layout
    return copy
}

function churchBlob(service: ChurchService): ChurchBlob {
    return {
        version: CHURCH_VERSION,
        date: service.date,
        advertisedTime: service.advertisedTime,
        startTime: service.startTime,
        timingMode: service.timingMode,
        countdownDurationSeconds: service.countdownDurationSeconds
    }
}

export function showFileName(serviceName: string, itemName: string): string {
    return `${serviceName} – ${itemName}`
}

/**
 * Project-list label. Only a Sunday item uses the short name on the project ref.
 * Other projects keep the show's stored name, which is what renames and imports update.
 */
export function projectItemLabel(isProject: boolean, refName: string | undefined, storedName: string | undefined, church: unknown): string | undefined {
    if (isProject && church && refName) return refName
    return storedName
}

export function nextSunday(from = new Date()): string {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    const day = date.getDay()
    const add = day === 0 ? 0 : 7 - day
    date.setDate(date.getDate() + add)
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const dayOfMonth = String(date.getDate()).padStart(2, "0")
    return `${date.getFullYear()}-${month}-${dayOfMonth}`
}

function sectionClock(kind: SectionKind, service: ChurchService): string | undefined {
    if (kind !== "warmup" && kind !== "service") return undefined
    const window = countdownWindow(service.timingMode, service.startTime, service.countdownDurationSeconds)
    // FreeShow's time box reads 24-hour "HH:MM". Locale text is only for the booth sentence.
    return (kind === "warmup" ? window.starts : window.ends).slice(0, 5)
}

const MEDIA_TYPES: ItemType[] = ["video", "image", "audio"]

function itemRef(service: ChurchService, item: ServiceItem, showId: string | undefined): ProjectShowRef {
    const autoAdvance = autoAdvanceEnabled(item)
    const blob: ItemBlob = {
        itemId: item.id,
        itemType: item.type,
        autoAdvance,
        timeframe: item.timeframe,
        scripture: item.scripture,
        slides: item.slides,
        mediaPath: item.mediaPath,
        parts: item.parts,
        arrangement: item.arrangement
    }
    // The project list shows the short label. The show file uses the dated name.
    if (MEDIA_TYPES.includes(item.type)) {
        return { id: item.mediaPath || item.id, type: item.type === "image" || item.type === "audio" ? item.type : "video", name: item.name, data: { church: blob } }
    }
    return { id: showId || `${service.id}--${item.id}`, type: "show", name: item.name, data: { church: blob } }
}

function buildShow(service: ChurchService, item: ServiceItem, created: number): { id: string; show: Show } | null {
    if (MEDIA_TYPES.includes(item.type)) return null
    const showId = `${service.id}--${item.id}`
    const slides: Show["slides"] = {}
    const layoutSlides: SlideData[] = []

    if (item.type === "song") {
        for (const part of item.parts || []) slides[part.id] = textSlide(part.label, part.text)
        const order = item.arrangement?.length ? item.arrangement : (item.parts || []).map((part) => part.id)
        for (const partId of order) layoutSlides.push({ id: partId })
    } else {
        const pages = textPages(item)
        for (const page of pages) slides[page.id] = textSlide(null, page.text)
        for (const page of pages) layoutSlides.push({ id: page.id })
    }

    const last = layoutSlides[layoutSlides.length - 1]
    if (last && item.timeframe?.durationSeconds != null) last.nextTimer = Math.round(item.timeframe.durationSeconds)
    if (last && item.timeframe?.onMediaEnd) last.actions = { nextAfterMedia: true }

    const show: Show = {
        name: showFileName(service.name, item.name),
        origin: CHURCH_ORIGIN,
        category: null,
        settings: { activeLayout: "arrangement", template: null },
        timestamps: { created, modified: null, used: null },
        meta: {},
        slides,
        layouts: { arrangement: { name: "Arrangement", notes: "", slides: layoutSlides } },
        media: {}
    }
    if (item.type === "scripture") show.reference = { type: "scripture", data: { passage: item.scripture || item.name } }
    return { id: showId, show }
}

function textPages(item: ServiceItem): TextPage[] {
    if (item.slides?.length) return item.slides
    if (item.scripture) return [{ id: "scripture", text: item.scripture }]
    return [{ id: "slide-1", text: item.name }]
}

function textSlide(group: SongPartLabel | null, text: string): Slide {
    const fields = group ? SONG_GROUP_FIELDS[group] : null
    return {
        group,
        globalGroup: group || undefined,
        color: fields?.color || null,
        settings: {},
        notes: "",
        items: [
            {
                type: "text",
                style: DEFAULT_ITEM_STYLE,
                lines: text.split("\n").map((value) => ({ align: "", text: [{ value, style: "" }] }))
            }
        ]
    }
}

function readBlob(project: StoredProject): ChurchBlob {
    if (project.church?.version === CHURCH_VERSION) return project.church
    for (const ref of project.shows || []) {
        const service = (ref.data?.church as SectionBlob | undefined)?.service
        if (service?.version === CHURCH_VERSION) return service
    }
    throw new Error("This project is not a Sunday service")
}

function sectionKind(ref: ProjectShowRef): SectionKind {
    const kind = (ref.data?.church as SectionBlob | undefined)?.kind
    if (kind && (SECTION_KINDS as readonly string[]).includes(kind)) return kind
    return "custom"
}

function readItem(stored: StoredService, ref: ProjectShowRef): ServiceItem {
    const blob = ref.data?.church as ItemBlob | undefined
    const show = stored.shows[ref.id]
    const type = blob?.itemType && (ITEM_TYPES as readonly string[]).includes(blob.itemType) ? blob.itemType : inferType(ref, show)
    const timeframe = readTimeframe(blob, show)
    const item: ServiceItem = {
        id: itemId(ref, show, blob),
        type,
        name: ref.name || show?.name || "Item",
        autoAdvance: typeof blob?.autoAdvance === "boolean" ? blob.autoAdvance : autoAdvanceEnabled({ timeframe })
    }
    if (timeframe) item.timeframe = timeframe
    if (type === "video" || type === "image" || type === "audio") {
        item.mediaPath = blob?.mediaPath || ref.id
        return item
    }
    if (type === "song") {
        const song = readSong(show, blob)
        item.parts = song.parts
        item.arrangement = song.arrangement
        return item
    }
    if (type === "scripture") item.scripture = blob?.scripture || show?.reference?.data?.passage || slideText(firstSlide(show))
    item.slides = readPages(show, blob)
    return item
}

function itemId(ref: ProjectShowRef, show: Show | undefined, blob: ItemBlob | undefined): string {
    if (blob?.itemId) return blob.itemId
    if (show?.name && ref.id.includes("--")) return ref.id.slice(ref.id.lastIndexOf("--") + 2)
    if (ref.type === "video" || ref.type === "image" || ref.type === "audio") return ref.id.split("/").pop() || ref.id
    return ref.id
}

function inferType(ref: ProjectShowRef, show: Show | undefined): ItemType {
    if (ref.type === "image" || ref.type === "audio" || ref.type === "video") return ref.type
    if (show?.reference?.type === "scripture") return "scripture"
    const groups = Object.values(show?.slides || {}).map((slide) => normalizeLabel(slide.group))
    if (groups.some((label) => label !== null)) return "song"
    return "announcement"
}

function readTimeframe(blob: ItemBlob | undefined, show: Show | undefined): Timeframe | undefined {
    if (blob?.timeframe && timeframeIsSet(blob.timeframe)) return blob.timeframe
    const last = lastLayoutSlide(show)
    const timeframe: Timeframe = {}
    if (last?.nextTimer != null) timeframe.durationSeconds = last.nextTimer
    if (last?.actions?.nextAfterMedia) timeframe.onMediaEnd = true
    return timeframeIsSet(timeframe) ? timeframe : undefined
}

function readSong(show: Show | undefined, blob: ItemBlob | undefined): { parts: SongPart[]; arrangement: string[] } {
    const layout = show?.layouts?.arrangement || (show ? Object.values(show.layouts || {})[0] : undefined)
    const arrangement = layout?.slides?.map((slide) => slide.id) || blob?.arrangement || []
    if (!show?.slides) return { parts: blob?.parts || [], arrangement }
    const parts: SongPart[] = []
    const seen = new Set<string>()
    for (const id of [...Object.keys(show.slides), ...arrangement]) {
        if (seen.has(id) || !show.slides[id]) continue
        seen.add(id)
        parts.push({ id, label: normalizeLabel(show.slides[id].group) || "verse", text: slideText(show.slides[id]) })
    }
    return { parts, arrangement }
}

function readPages(show: Show | undefined, blob: ItemBlob | undefined): TextPage[] {
    const layout = show?.layouts?.arrangement || (show ? Object.values(show.layouts || {})[0] : undefined)
    if (show?.slides && layout?.slides?.length) {
        return layout.slides.map((slide) => ({ id: slide.id, text: slideText(show.slides[slide.id]) }))
    }
    if (blob?.slides?.length) return blob.slides
    const only = firstSlide(show)
    return [{ id: "slide-1", text: slideText(only) || show?.name || "" }]
}

function firstSlide(show: Show | undefined): Slide | undefined {
    if (!show?.slides) return undefined
    return Object.values(show.slides)[0]
}

function lastLayoutSlide(show: Show | undefined): SlideData | undefined {
    const layout = show?.layouts?.arrangement || (show ? Object.values(show.layouts || {})[0] : undefined)
    if (!layout?.slides?.length) return undefined
    return layout.slides[layout.slides.length - 1]
}

function slideText(slide: Slide | undefined): string {
    const lines = (slide?.items || []).flatMap((item) => item.lines || [])
    return lines.map((line) => (line.text || []).map((part) => part.value || "").join("")).join("\n")
}

function normalizeLabel(group: string | null | undefined): SongPartLabel | null {
    const label = (group || "").trim().toLowerCase()
    if ((SONG_PART_LABELS as readonly string[]).includes(label)) return label as SongPartLabel
    return null
}
