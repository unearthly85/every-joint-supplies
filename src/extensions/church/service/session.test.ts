import { writable } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { faithCovenantSunday, toStored } from "./model"
import { setChurchClock } from "./clock"

const activeProject = writable<string | null>(null)
const activeShow = writable<{ index?: number } | null>(null)
const projects = writable<Record<string, unknown>>({})

vi.mock("../../../frontend/stores", () => ({
    activeProject,
    activeShow,
    projects
}))

const advanced: number[] = []

describe("live handoff session", () => {
    beforeEach(async () => {
        advanced.length = 0
        activeProject.set(null)
        activeShow.set(null)
        projects.set({})
        setChurchClock(null)
        const session = await import("./session")
        session.resetChurchSession()
        session.onChurchAdvance((index) => advanced.push(index))
    })

    it("moves from the pre-service loop to the countdown at 10:27 and then to the announcement", async () => {
        const service = faithCovenantSunday("2026-11-22")
        const stored = toStored(service)
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        const announcement = stored.project.shows.findIndex((ref) => ref.name === "Announcements")
        activeShow.set({ index: welcome })

        setChurchClock(() => new Date(2026, 10, 22, 10, 0, 0))
        const { churchTick } = await import("./session")
        churchTick()
        expect(advanced).toEqual([])

        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        churchTick()
        expect(advanced).toEqual([countdown])

        activeShow.set({ index: countdown })
        setChurchClock(() => new Date(2026, 10, 22, 10, 32, 0))
        churchTick()
        expect(advanced).toEqual([countdown, announcement])
    })

    it("does not let the old clock move the service after a manual advance", async () => {
        const service = faithCovenantSunday("2026-11-22")
        const stored = toStored(service)
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        activeShow.set({ index: welcome })
        setChurchClock(() => new Date(2026, 10, 22, 10, 20, 0))
        const { churchNoteManual, churchTick } = await import("./session")
        churchTick()
        churchNoteManual()
        activeShow.set({ index: countdown })
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        churchTick()
        expect(advanced).toEqual([])
    })
})
