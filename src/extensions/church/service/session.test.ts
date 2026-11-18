import { get, writable } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { faithCovenantSunday, toStored } from "./model"
import { setChurchClock } from "./clock"
import { booth } from "./booth"

const activeProject = writable<string | null>(null)
const projects = writable<Record<string, unknown>>({})
const outputs = writable<Record<string, unknown>>({})

vi.mock("../../../frontend/stores", () => ({
    activeProject,
    projects,
    outputs
}))

const advanced: number[] = []

function showLive(index: number, kind: "slide" | "background" = "slide") {
    outputs.set({
        main: {
            enabled: true,
            active: true,
            out: kind === "slide" ? { slide: { id: "live", projectIndex: index } } : { background: { path: "media/countdown.mp4", projectIndex: index } }
        }
    })
}

describe("live handoff session", () => {
    beforeEach(async () => {
        advanced.length = 0
        activeProject.set(null)
        projects.set({})
        outputs.set({})
        setChurchClock(null)
        const session = await import("./session")
        session.resetChurchSession()
        session.onChurchAdvance((index) => advanced.push(index))
    })

    it("moves from the live pre-service loop to the countdown at 10:27", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        showLive(welcome)
        setChurchClock(() => new Date(2026, 10, 22, 10, 0, 0))
        const { churchTick } = await import("./session")
        churchTick()
        expect(advanced).toEqual([])

        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        churchTick()
        expect(advanced).toEqual([countdown])
    })

    it("keeps the handoff when another item is only previewed", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        showLive(welcome)
        setChurchClock(() => new Date(2026, 10, 22, 10, 0, 0))
        const { churchTick } = await import("./session")
        churchTick()
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        churchTick()
        expect(advanced).toEqual([countdown])
    })

    it("advances only when the ended media is the armed countdown", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        const announcement = stored.project.shows.findIndex((ref) => ref.name === "Announcements")
        showLive(countdown, "background")
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        const { churchOnMediaEnded, churchTick } = await import("./session")
        churchTick()
        expect(churchOnMediaEnded("other.mp4")).toBe(false)
        expect(advanced).toEqual([])
        expect(churchOnMediaEnded("media/countdown.mp4")).toBe(true)
        expect(advanced).toEqual([announcement])
    })

    it("does not let the old clock move the service after a manual advance", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        showLive(welcome)
        setChurchClock(() => new Date(2026, 10, 22, 10, 20, 0))
        const { churchNoteManual, churchTick } = await import("./session")
        churchTick()
        churchNoteManual({ projectIndex: countdown })
        showLive(countdown, "background")
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        churchTick()
        expect(advanced).toEqual([])
    })

    it("keeps the 10:27 handoff when the click stays on the live loop", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        const showId = stored.project.shows[welcome].id
        showLive(welcome)
        setChurchClock(() => new Date(2026, 10, 22, 10, 5, 0))
        const { churchNoteManual, churchTick } = await import("./session")
        churchTick()
        churchNoteManual({ projectIndex: welcome, showId })
        churchNoteManual({ projectIndex: null, showId })
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        churchTick()
        expect(advanced).toEqual([countdown])
    })

    it("says auto-advance is off when the loop is opened after its deadline", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const announcement = stored.project.shows.findIndex((ref) => ref.name === "Announcements")
        showLive(welcome)
        setChurchClock(() => new Date(2026, 10, 22, 10, 0, 0))
        const { churchNoteManual, churchTick, AUTO_ADVANCE_OFF } = await import("./session")
        churchTick()
        churchNoteManual({ projectIndex: announcement })
        showLive(announcement)
        churchTick()
        expect(get(booth)?.remaining).not.toBe(AUTO_ADVANCE_OFF)
        setChurchClock(() => new Date(2026, 10, 22, 10, 40, 0))
        showLive(welcome)
        churchTick()
        expect(get(booth)?.remaining).toBe(AUTO_ADVANCE_OFF)
        expect(advanced).toEqual([])
    })

    it("drops the handoff when auto-advance is turned off on the live item", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        showLive(welcome)
        setChurchClock(() => new Date(2026, 10, 22, 10, 0, 0))
        const { churchTick } = await import("./session")
        churchTick()
        stored.project.shows[welcome].data!.church!.autoAdvance = false
        projects.set({ [stored.projectId]: stored.project })
        churchTick()
        const { AUTO_ADVANCE_OFF } = await import("./session")
        expect(get(booth)?.remaining).toBe(AUTO_ADVANCE_OFF)
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        churchTick()
        expect(advanced).toEqual([])
    })
})
