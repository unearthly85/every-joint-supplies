import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../../types/Projects"
import type { Show } from "../../../types/Show"
import {
    autoAdvanceEnabled,
    countdownLine,
    countdownWindow,
    FAITH_COVENANT_SUNDAY,
    faithCovenantSunday,
    fromStored,
    parseClock,
    simulateFreeShowSave,
    timeframeIsSet,
    toStored,
    type ChurchService,
    type ServiceItem,
    type StoredService
} from "./model"

const DATE = "2026-11-22"

function roundTrip(service: ChurchService): ChurchService {
    return fromStored(simulateFreeShowSave(JSON.parse(JSON.stringify(toStored(service)))))
}

function blocks(refs: ProjectShowRef[]): ProjectShowRef[][] {
    const grouped: ProjectShowRef[][] = []
    for (const ref of refs) {
        if (ref.type === "section" || grouped.length === 0) grouped.push([ref])
        else grouped[grouped.length - 1].push(ref)
    }
    return grouped
}

describe("countdown times", () => {
    it("mode A starts the countdown at the configured start time", () => {
        expect(countdownWindow("A", FAITH_COVENANT_SUNDAY.startTime, FAITH_COVENANT_SUNDAY.countdownDurationMs)).toEqual({ starts: "10:27", ends: "10:32" })
        expect(countdownLine({ timingMode: "A", startTime: "10:27", countdownDurationMs: 5 * 60 * 1000 })).toBe("Countdown starts 10:27, ends 10:32")
    })

    it("mode B starts the countdown so it ends at the start time", () => {
        expect(countdownWindow("B", "10:30", 5 * 60 * 1000)).toEqual({ starts: "10:25", ends: "10:30" })
        expect(countdownWindow("B", "10:27", 5 * 60 * 1000)).toEqual({ starts: "10:22", ends: "10:27" })
        expect(countdownLine({ timingMode: "B", startTime: "10:30", countdownDurationMs: 5 * 60 * 1000 })).toBe("Countdown starts 10:25, ends 10:30")
    })

    it("wraps past midnight in either direction", () => {
        expect(countdownWindow("A", "23:50", 20 * 60 * 1000)).toEqual({ starts: "23:50", ends: "00:10" })
        expect(countdownWindow("B", "00:02", 5 * 60 * 1000)).toEqual({ starts: "23:57", ends: "00:02" })
        expect(countdownWindow("A", "10:00", 0)).toEqual({ starts: "10:00", ends: "10:00" })
    })

    it("reads a clock with or without seconds and rejects anything else", () => {
        expect(parseClock("10:30")).toBe(630)
        expect(parseClock("9:05:00")).toBe(545)
        expect(() => parseClock("10:60")).toThrow(/10:30/)
        expect(() => parseClock("24:00")).toThrow(/10:30/)
        expect(() => parseClock("morning")).toThrow(/10:30/)
    })
})

describe("auto-advance", () => {
    it("turns on when a timeframe is set and stays off when one is not", () => {
        expect(timeframeIsSet(undefined)).toBe(false)
        expect(timeframeIsSet({})).toBe(false)
        expect(timeframeIsSet({ untilTime: "" })).toBe(false)
        expect(timeframeIsSet({ onMediaEnd: false })).toBe(false)
        expect(autoAdvanceEnabled({})).toBe(false)
        expect(autoAdvanceEnabled({ timeframe: { durationMs: 1000 } })).toBe(true)
        expect(autoAdvanceEnabled({ timeframe: { untilTime: "10:32" } })).toBe(true)
        expect(autoAdvanceEnabled({ timeframe: { onMediaEnd: true } })).toBe(true)
        expect(autoAdvanceEnabled({ autoAdvance: false, timeframe: { durationMs: 1000 } })).toBe(false)
        expect(autoAdvanceEnabled({ autoAdvance: true })).toBe(true)
    })
})

describe("Faith Covenant Sunday", () => {
    it("instantiates a dated service and round-trips through stored project and show data", () => {
        const service = faithCovenantSunday(DATE)
        expect(service.name).toBe(`Sunday ${DATE}`)
        expect(service.advertisedTime).toBe("10:30")
        expect(service.startTime).toBe("10:27")
        expect(service.timingMode).toBe("A")
        expect(service.sections.map((section) => section.kind)).toEqual(["pre_service_loop", "warmup", "service"])

        const stored = toStored(service)
        expect(stored.project.origin).toBe("church-service")
        expect(stored.project.created).toBe(Date.parse(`${DATE}T12:00:00Z`))
        expect(stored.project.shows.map((ref) => ref.type)).toEqual(["section", "show", "section", "video", "section", "show", "show", "show"])
        expect(stored.project.shows[0].loop).toBe(true)
        expect(stored.project.shows[2].loop).toBe(false)
        expect(stored.project.shows[0].data.time).toBeUndefined()

        const song = stored.shows[`${service.id}--song`]
        expect(song.settings.activeLayout).toBe("arrangement")
        expect(song.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(["verse-1", "chorus", "verse-1", "chorus", "bridge", "chorus", "tag"])
        expect(song.slides["verse-1"].group).toBe("verse")
        expect(song.slides.chorus.group).toBe("chorus")
        expect(song.slides.bridge.group).toBe("bridge")
        expect(song.slides.tag.group).toBe("tag")
        expect(stored.shows[`${service.id}--scripture`].reference).toEqual({ type: "scripture", data: { passage: "Psalm 100" } })

        const video = stored.project.shows.find((ref) => ref.type === "video")
        expect(video?.id).toBe("media/countdown.mp4")
        expect(video?.data.church.autoAdvance).toBe(true)
        expect(video?.data.church.timeframe).toEqual({ durationMs: 5 * 60 * 1000, onMediaEnd: true })

        const restored = fromStored(simulateFreeShowSave(JSON.parse(JSON.stringify(stored))))
        expect(restored.advertisedTime).toBe("10:30")
        expect(restored.startTime).toBe("10:27")
        expect(restored.timingMode).toBe("A")
        expect(restored.countdownDurationMs).toBe(5 * 60 * 1000)
        expect(restored.sections.map((section) => section.kind)).toEqual(["pre_service_loop", "warmup", "service"])
        expect(restored.sections[2].items.map((item) => item.type)).toEqual(["announcement", "scripture", "song"])
        const restoredSong = restored.sections[2].items[2]
        expect(restoredSong.arrangement).toEqual(["verse-1", "chorus", "verse-1", "chorus", "bridge", "chorus", "tag"])
        expect(restoredSong.parts?.map((part) => part.label)).toEqual(["verse", "chorus", "bridge", "tag"])
        expect(restored.sections[1].items[0].autoAdvance).toBe(true)
        expect(restored.sections[0].items[0].autoAdvance).toBe(false)
    })

    it("keeps section order from the project list and the arrangement from the show layout", () => {
        const stored = toStored(faithCovenantSunday(DATE))
        stored.project.shows = blocks(stored.project.shows).reverse().flat()
        const songId = Object.keys(stored.shows).find((id) => id.endsWith("--song")) as string
        stored.shows[songId].layouts.arrangement.slides = [{ id: "chorus" }, { id: "chorus" }, { id: "tag" }]

        const restored = fromStored(stored)
        expect(restored.sections.map((section) => section.kind)).toEqual(["service", "warmup", "pre_service_loop"])
        expect(restored.sections[0].items.find((item) => item.type === "song")?.arrangement).toEqual(["chorus", "chorus", "tag"])
    })

    it("keeps mode, until-time, and an explicit auto-advance off", () => {
        const service = faithCovenantSunday(DATE, { timingMode: "B", advertisedTime: "10:45", startTime: "10:30", name: "Evening" })
        service.countdownDurationMs = 5 * 60 * 1000
        service.sections[2].items[0].timeframe = { untilTime: "10:35" }
        service.sections[2].items[0].autoAdvance = false
        service.sections.push({
            id: "after",
            kind: "post_service",
            name: "After",
            items: [
                {
                    id: "sermon",
                    type: "sermon",
                    name: "Sermon",
                    slides: [
                        { id: "point-1", text: "First point" },
                        { id: "point-2", text: "Second point" }
                    ],
                    timeframe: { durationMs: 30_000 }
                }
            ]
        })
        service.sections.push({ id: "extra", kind: "custom", name: "Extra", items: [] })

        const stored = toStored(service)
        const sermon = stored.shows[`${service.id}--sermon`]
        expect(sermon.layouts.arrangement.slides.map((slide) => slide.id)).toEqual(["point-1", "point-2"])
        expect(sermon.layouts.arrangement.slides[1].nextTimer).toBe(30)
        expect(sermon.layouts.arrangement.slides[0].nextTimer).toBeUndefined()
        const announcement = stored.shows[`${service.id}--announcements`]
        expect(announcement.layouts.arrangement.slides[0].nextTimer).toBeUndefined()
        expect(announcement.layouts.arrangement.slides[0].actions).toBeUndefined()

        const restored = roundTrip(service)
        expect(restored.name).toBe("Evening")
        expect(restored.timingMode).toBe("B")
        expect(restored.advertisedTime).toBe("10:45")
        expect(restored.startTime).toBe("10:30")
        expect(countdownWindow(restored.timingMode, restored.startTime, restored.countdownDurationMs)).toEqual({ starts: "10:25", ends: "10:30" })
        expect(restored.sections.map((section) => section.kind)).toEqual(["pre_service_loop", "warmup", "service", "post_service", "custom"])
        expect(restored.sections[2].items[0].timeframe).toEqual({ untilTime: "10:35" })
        expect(restored.sections[2].items[0].autoAdvance).toBe(false)
        expect(restored.sections[3].items[0].slides).toEqual([
            { id: "point-1", text: "First point" },
            { id: "point-2", text: "Second point" }
        ])
        expect(restored.sections[4].items).toEqual([])
    })

    it("rejects a service that is not ready to store", () => {
        expect(() => faithCovenantSunday("22 Nov")).toThrow(/date/)
        expect(() => faithCovenantSunday(DATE, { timingMode: "C" as "A" })).toThrow(/mode/)
        expect(() => faithCovenantSunday(DATE, { countdownDurationMs: -1 })).toThrow(/negative/)
        expect(() => faithCovenantSunday(DATE, { startTime: "noon" })).toThrow(/10:30/)
        expect(() => fromStored({ projectId: "x", project: { name: "x", created: 0, parent: "/", shows: [] }, shows: {} })).toThrow(/not a Sunday/)
    })

    it("reads a service from a section when the project record itself has no church block", () => {
        const stored = toStored(faithCovenantSunday(DATE))
        delete stored.project.church
        const restored = fromStored(stored)
        expect(restored.startTime).toBe("10:27")
        expect(restored.timingMode).toBe("A")
    })

    it("recovers a timeframe FreeShow already stored on the last slide", () => {
        const stored = toStored(faithCovenantSunday(DATE))
        const songId = `${stored.projectId}--song`
        const songRef = stored.project.shows.find((ref) => ref.id === songId) as ProjectShowRef
        delete songRef.data.church.timeframe
        delete songRef.data.church.autoAdvance
        const slides = stored.shows[songId].layouts.arrangement.slides
        slides[slides.length - 1].nextTimer = 12
        slides[slides.length - 1].actions = { nextAfterMedia: true }

        const restored = fromStored(stored)
        const song = restored.sections[2].items[2]
        expect(song.timeframe).toEqual({ durationMs: 12_000, onMediaEnd: true })
        expect(song.autoAdvance).toBe(true)
    })

    it("fills in items that were not written by this module", () => {
        const slide = { color: null, settings: {}, notes: "", items: [] }
        const imported: Show = {
            name: "Imported",
            category: null,
            settings: { activeLayout: "arrangement", template: null },
            timestamps: { created: 0, modified: null, used: null },
            meta: {},
            slides: { chorus: { ...slide, group: "Chorus" } },
            layouts: { arrangement: { name: "Arrangement", notes: "", slides: [{ id: "chorus" }] } },
            media: {}
        }
        const reading: Show = {
            name: "Reading",
            category: null,
            settings: { activeLayout: "arrangement", template: null },
            timestamps: { created: 0, modified: null, used: null },
            reference: { type: "scripture", data: { passage: "John 1" } },
            meta: {},
            slides: { page: { ...slide, group: null, items: [{ style: "", lines: [{ align: "", text: [{ value: "In the beginning", style: "" }] }] }] } },
            layouts: {},
            media: {}
        }
        const note: Show = {
            name: "Note",
            category: null,
            settings: { activeLayout: "arrangement", template: null },
            timestamps: { created: 0, modified: null, used: null },
            meta: {},
            slides: { page: { ...slide, group: null } },
            layouts: {},
            media: {}
        }
        const stored: StoredService = {
            projectId: "loose",
            project: {
                name: "Loose",
                created: 0,
                parent: "/",
                church: { version: 1, date: DATE, advertisedTime: "10:30", startTime: "10:27", timingMode: "A", countdownDurationMs: 0 },
                shows: [
                    { id: "clip.mp4", type: "video", name: "Clip" },
                    { id: "section-1", type: "section" },
                    { id: "loose--imported", type: "show" },
                    { id: "photo.png", type: "image", name: "Photo" },
                    { id: "bed.mp3", type: "audio" },
                    { id: "plain", type: "show", name: "Plain" },
                    { id: "/", type: "video" }
                ]
            },
            shows: { "loose--imported": imported, plain: note, "loose--reading": reading }
        }
        stored.project.shows.splice(5, 0, { id: "loose--reading", type: "show" })
        const restored = fromStored(stored)
        expect(restored.sections[0].kind).toBe("custom")
        expect(restored.sections[0].name).toBe("Service")
        expect(restored.sections[0].items[0]).toMatchObject({ id: "clip.mp4", type: "video" })
        expect(restored.sections[1].name).toBe("Section")
        expect(restored.sections[1].kind).toBe("custom")
        expect(restored.sections[1].items.map((item) => item.type)).toEqual(["song", "video", "video", "scripture", "announcement", "video"])
        expect(restored.sections[1].items[0]).toMatchObject({ id: "imported", parts: [{ id: "chorus", label: "chorus", text: "" }] })
        expect(restored.sections[1].items[1].mediaPath).toBe("photo.png")
        expect(restored.sections[1].items[3].scripture).toBe("John 1")
        expect(restored.sections[1].items[4].id).toBe("plain")
        expect(restored.sections[1].items[5].id).toBe("/")
        expect(restored.timingMode).toBe("A")
    })

    it("uses an item's own text when it has no arrangement yet", () => {
        const service = faithCovenantSunday(DATE)
        const bare: ServiceItem = { id: "reading", type: "scripture", name: "Reading", scripture: "John 1" }
        const pages: ServiceItem = { id: "notice", type: "announcement", name: "Notice" }
        const sung: ServiceItem = {
            id: "simple",
            type: "song",
            name: "Simple",
            parts: [{ id: "verse-1", label: "verse", text: "Line" }],
            timeframe: { onMediaEnd: true }
        }
        const emptySong: ServiceItem = { id: "empty-song", type: "song", name: "Empty", parts: [], timeframe: { durationMs: 1000, onMediaEnd: true } }
        service.sections = [{ id: "only", kind: "service", name: "Service", items: [bare, pages, sung, emptySong] }]
        const stored = toStored(service)
        expect(stored.shows[`${service.id}--reading`].slides.scripture.items[0].lines?.[0].text[0].value).toBe("John 1")
        expect(stored.shows[`${service.id}--notice`].slides["slide-1"].items[0].lines?.[0].text[0].value).toBe("Notice")
        expect(stored.shows[`${service.id}--simple`].layouts.arrangement.slides).toEqual([{ id: "verse-1", actions: { nextAfterMedia: true } }])
        expect(stored.shows[`${service.id}--empty-song`].layouts.arrangement.slides).toEqual([])

        delete stored.shows[`${service.id}--simple`].slides
        delete stored.shows[`${service.id}--notice`].layouts
        simulateFreeShowSave(stored)
        const restored = fromStored(stored)
        expect(restored.sections[0].items[2].parts).toEqual([{ id: "verse-1", label: "verse", text: "Line" }])
        expect(restored.sections[0].items[2].arrangement).toEqual(["verse-1"])
        expect(restored.sections[0].items[1].slides).toEqual([{ id: "slide-1", text: "Notice" }])
        expect(restored.sections[0].items[3].parts).toEqual([])
    })

    it("still stores a service whose date is not a real calendar day", () => {
        const service = faithCovenantSunday("2026-99-99")
        expect(toStored(service).project.created).toBe(0)
        const stored = toStored(faithCovenantSunday(DATE))
        delete stored.project.shows
        expect(fromStored(stored).sections).toEqual([])
        expect(simulateFreeShowSave(stored).project.shows).toBeUndefined()
    })

    it("treats a blank song group as a verse and ignores an empty slide list", () => {
        const stored = toStored(faithCovenantSunday(DATE))
        const songId = `${stored.projectId}--song`
        stored.shows[songId].slides.extra = { group: "", color: null, settings: {}, notes: "", items: [] }
        stored.shows[songId].layouts.arrangement.slides.push({ id: "extra" })
        stored.project.shows.find((ref) => ref.id === songId)!.data.church.itemType = "not-a-type"
        const restored = fromStored(stored)
        const song = restored.sections[2].items[2]
        expect(song.type).toBe("song")
        expect(song.parts?.find((part) => part.id === "extra")?.label).toBe("verse")
        expect(song.parts?.find((part) => part.id === "extra")?.text).toBe("")
    })
})
