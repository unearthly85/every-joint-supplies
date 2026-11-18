import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { faithCovenantSunday, toStored } from "./model"
import { setChurchClock } from "./clock"
import { booth } from "./booth"

const setOutput = vi.fn()
const openProjectItem = vi.fn()
const audioStart = vi.fn()
const getAllActiveOutputIds = vi.fn(() => ["out"])
const getMedia = vi.fn()
const isMainWindow = vi.fn(() => true)
const groupsSubscribe = vi.fn()
const groupsSet = vi.fn()
let mockGroupsValue: object = {}

const projects = writable<Record<string, { shows: any[] }>>({})
const activeProject = writable<string | null>("sunday")
const showsCache = writable<Record<string, { settings: { activeLayout: string } }>>({
    show1: { settings: { activeLayout: "arrangement" } }
})
const outputs = writable<Record<string, any>>({})
const playingVideos = writable<any[]>([])

vi.mock("../../../frontend/stores", () => ({
    activeProject,
    projects,
    showsCache,
    outputs,
    playingVideos,
    groups: {
        subscribe: (run: (value: object) => void) => groupsSubscribe(run),
        set: (value: object) => groupsSet(value)
    }
}))
vi.mock("../../../frontend/components/helpers/output", () => ({
    getAllActiveOutputIds: () => getAllActiveOutputIds(),
    setOutput: (...args: unknown[]) => setOutput(...args)
}))
vi.mock("../../../frontend/components/helpers/media", () => ({
    getMedia: (...args: unknown[]) => getMedia(...args)
}))
vi.mock("../../../frontend/audio/audioPlayer", () => ({
    AudioPlayer: { start: (...args: unknown[]) => audioStart(...args) }
}))
vi.mock("../../../frontend/components/show/project", () => ({
    openProjectItem: (...args: unknown[]) => openProjectItem(...args)
}))
vi.mock("../../../frontend/utils/common", () => ({
    isMainWindow: () => isMainWindow()
}))

interface TestOutputView {
    background: string
    slideId: string
    projectIndex: number | null
    playing: { path: string; paused: boolean; time: number }[]
}

function ejsOutput(): TestOutputView | undefined {
    return (globalThis as { __ejsOutput?: () => TestOutputView }).__ejsOutput?.()
}

beforeEach(async () => {
    setOutput.mockClear()
    openProjectItem.mockClear()
    audioStart.mockClear()
    getAllActiveOutputIds.mockReset()
    getAllActiveOutputIds.mockReturnValue(["out"])
    getMedia.mockReset()
    getMedia.mockImplementation(async (path: string) => ({ path }))
    isMainWindow.mockReset()
    isMainWindow.mockReturnValue(true)
    groupsSubscribe.mockReset()
    groupsSubscribe.mockImplementation((run: (value: object) => void) => {
        run(mockGroupsValue)
        return () => undefined
    })
    groupsSet.mockClear()
    mockGroupsValue = {}
    showsCache.set({ show1: { settings: { activeLayout: "arrangement" } } })
    outputs.set({})
    playingVideos.set([])
    const { resetChurchSession } = await import("./session")
    resetChurchSession()
    booth.set(null)
})

afterEach(async () => {
    const { stopChurchHandoff } = await import("./runtime")
    stopChurchHandoff()
    setChurchClock(null)
    booth.set(null)
    delete (globalThis as { __ejsTestClock?: boolean }).__ejsTestClock
    delete (globalThis as { __ejsOutput?: () => TestOutputView }).__ejsOutput
    delete (globalThis as { __ejsTick?: () => void }).__ejsTick
})

describe("live output", () => {
    beforeEach(() => {
        setOutput.mockClear()
        openProjectItem.mockClear()
        audioStart.mockClear()
        projects.set({
            sunday: {
                shows: [
                    { id: "/videos/count.mp4", type: "video", name: "Countdown video", data: { church: { mediaPath: "/videos/count.mp4", timeframe: { onMediaEnd: true } } } },
                    { id: "show1", type: "show", name: "Announcements" },
                    { id: "/audio/bed.mp3", type: "audio", name: "Bed", data: { church: { mediaPath: "/audio/bed.mp3" } } }
                ]
            }
        })
    })

    it("starts a countdown video on the background output and a show on the slide", async () => {
        const { showLiveItem, stopChurchHandoff, watchChurchHandoff } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(openProjectItem).toHaveBeenCalledWith("sunday", 0)
        expect(setOutput).toHaveBeenCalledWith("background", expect.objectContaining({ path: "/videos/count.mp4", type: "video", loop: false, projectIndex: 0 }), false, "out")

        setOutput.mockClear()
        await showLiveItem("sunday", 1)
        expect(setOutput).toHaveBeenCalledWith("slide", expect.objectContaining({ id: "show1", layout: "arrangement", projectIndex: 1 }), false, "out")

        await showLiveItem("sunday", 2)
        expect(audioStart).toHaveBeenCalledWith("/audio/bed.mp3", { name: "Bed" })

        watchChurchHandoff()
        stopChurchHandoff()
    })
})

describe("live item branches", () => {
    beforeEach(() => {
        projects.set({})
        activeProject.set(null)
    })

    it("leaves the output alone when the item does not exist", async () => {
        projects.set({ sunday: { shows: [] } })
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(openProjectItem).toHaveBeenCalledWith("sunday", 0)
        expect(setOutput).not.toHaveBeenCalled()
    })

    it("leaves the output alone when no output is active", async () => {
        projects.set({ sunday: { shows: [{ id: "/videos/count.mp4", type: "video", name: "Countdown video" }] } })
        getAllActiveOutputIds.mockReturnValue([])
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(openProjectItem).toHaveBeenCalledWith("sunday", 0)
        expect(setOutput).not.toHaveBeenCalled()
    })

    it("treats an item without a type as a show", async () => {
        projects.set({ sunday: { shows: [{ id: "show1", name: "Untyped" }] } })
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(setOutput).toHaveBeenCalledWith("slide", expect.objectContaining({ id: "show1", layout: "arrangement", projectIndex: 0 }), false, "out")
    })

    it("falls back to the item id when no media path is stored", async () => {
        projects.set({ sunday: { shows: [{ id: "/videos/fallback.mp4", type: "video", name: "Fallback" }] } })
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(getMedia).toHaveBeenCalledWith("/videos/fallback.mp4")
        expect(setOutput).toHaveBeenCalledWith("background", expect.objectContaining({ path: "/videos/fallback.mp4", type: "video", loop: true }), false, "out")
    })

    it("starts unnamed audio with an empty name", async () => {
        projects.set({ sunday: { shows: [{ id: "/audio/unnamed.mp3", type: "audio", data: { church: { mediaPath: "/audio/unnamed.mp3" } } }] } })
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(audioStart).toHaveBeenCalledWith("/audio/unnamed.mp3", { name: "" })
    })

    it("leaves the output alone for an item type it does not drive", async () => {
        projects.set({ sunday: { shows: [{ id: "custom-1", type: "custom", name: "Custom" }] } })
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(openProjectItem).toHaveBeenCalledWith("sunday", 0)
        expect(setOutput).not.toHaveBeenCalled()
    })

    it("leaves the output alone when the show has no active layout", async () => {
        showsCache.set({ "show-empty": { settings: {} } })
        projects.set({
            sunday: {
                shows: [
                    { id: "show-missing", type: "show", name: "Missing" },
                    { id: "show-empty", type: "show", name: "Empty" }
                ]
            }
        })
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        await showLiveItem("sunday", 1)
        expect(setOutput).not.toHaveBeenCalled()
    })
})

describe("media locating", () => {
    beforeEach(() => {
        projects.set({ sunday: { shows: [{ id: "vid-1", type: "video", name: "Custom", data: { church: { mediaPath: "/media/custom.mp4" } } }] } })
        activeProject.set(null)
    })

    it("plays the stored path when locating returns nothing", async () => {
        getMedia.mockImplementation(async () => ({}))
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(setOutput).toHaveBeenCalledWith("background", expect.objectContaining({ path: "/media/custom.mp4", type: "video" }), false, "out")
    })

    it("plays the stored path when locating fails", async () => {
        getMedia.mockImplementation(async () => {
            throw new Error("media not found")
        })
        const { showLiveItem } = await import("./runtime")
        await showLiveItem("sunday", 0)
        expect(setOutput).toHaveBeenCalledWith("background", expect.objectContaining({ path: "/media/custom.mp4", type: "video" }), false, "out")
    })
})

describe("handoff", () => {
    beforeEach(() => {
        projects.set({})
        activeProject.set(null)
        setChurchClock(null)
        booth.set(null)
    })

    it("moves the live output when the session advances", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        const countdown = stored.project.shows.findIndex((ref) => ref.name === "Countdown video")
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        outputs.set({ main: { enabled: true, active: true, out: { slide: { id: "welcome-slide", projectIndex: welcome } } } })
        setChurchClock(() => new Date(2026, 10, 22, 10, 0, 0))
        const { watchChurchHandoff } = await import("./runtime")
        watchChurchHandoff()
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        const { churchTick } = await import("./session")
        churchTick()
        expect(openProjectItem).toHaveBeenCalledWith(stored.projectId, countdown)
        await vi.waitFor(() => {
            expect(setOutput).toHaveBeenCalledWith("slide", null, false, "out")
            expect(setOutput).toHaveBeenCalledWith("background", expect.objectContaining({ path: "media/countdown.mp4", type: "video", loop: false, projectIndex: countdown }), false, "out")
        })
    })

    it("does not tick the session while the main window is hidden", async () => {
        const stored = toStored(faithCovenantSunday("2026-11-22"))
        const welcome = stored.project.shows.findIndex((ref) => ref.name === "Welcome slides")
        projects.set({ [stored.projectId]: stored.project })
        activeProject.set(stored.projectId)
        outputs.set({ main: { enabled: true, active: true, out: { slide: { id: "welcome-slide", projectIndex: welcome } } } })
        setChurchClock(() => new Date(2026, 10, 22, 10, 27, 0))
        isMainWindow.mockReturnValue(false)
        const { watchChurchHandoff } = await import("./runtime")
        watchChurchHandoff()
        expect(openProjectItem).not.toHaveBeenCalled()
        expect(get(booth)).toBeNull()
    })

    it("ignores a second start while the handoff is running", async () => {
        const { watchChurchHandoff } = await import("./runtime")
        watchChurchHandoff()
        watchChurchHandoff()
        expect(groupsSubscribe).toHaveBeenCalledTimes(1)
    })

    it("keeps the tag shortcut when settings replace the groups", async () => {
        mockGroupsValue = { tag: { name: "Tag" } }
        const { watchChurchHandoff } = await import("./runtime")
        watchChurchHandoff()
        expect(groupsSet).toHaveBeenCalledWith({ tag: { name: "Tag", shortcut: "T" } })
    })
})

describe("test output", () => {
    beforeEach(() => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        projects.set({})
        activeProject.set(null)
    })

    it("does not expose the live output while the test clock is off", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = false
        const { watchChurchHandoff } = await import("./runtime")
        watchChurchHandoff()
        expect(ejsOutput()).toBeUndefined()
    })

    it("reports the live slide, background, project index, and playing media", async () => {
        outputs.set({
            old: { enabled: false, out: { slide: { id: "old", projectIndex: 3 } } },
            live: { active: true, out: { slide: { id: "slide-1", projectIndex: 1 }, background: { path: "media/bg.mp4" } } }
        })
        playingVideos.set([{ path: "media/countdown.mp4", audio: { paused: false, currentTime: 12.5 } }, { audio: { paused: true, currentTime: 0 } }])
        const { watchChurchHandoff } = await import("./runtime")
        watchChurchHandoff()
        expect(ejsOutput()).toEqual({
            background: "media/bg.mp4",
            slideId: "slide-1",
            projectIndex: 1,
            playing: [
                { path: "media/countdown.mp4", paused: false, time: 12.5 },
                { path: "", paused: true, time: 0 }
            ]
        })
    })

    it("falls back to the first output and to empty values", async () => {
        outputs.set({
            off: { enabled: false, out: { slide: { id: "off-slide", projectIndex: 5 } } },
            inactive: { active: false, out: { background: { path: "media/bg.mp4", projectIndex: 6 } } }
        })
        const { watchChurchHandoff } = await import("./runtime")
        watchChurchHandoff()
        expect(ejsOutput()).toEqual({ background: "", slideId: "off-slide", projectIndex: 5, playing: [] })

        outputs.set({ main: { out: { slide: { id: "slide-only" }, background: { path: "media/bg.mp4", projectIndex: 7 } } } })
        expect(ejsOutput()).toEqual({ background: "media/bg.mp4", slideId: "slide-only", projectIndex: 7, playing: [] })

        outputs.set({})
        expect(ejsOutput()).toEqual({ background: "", slideId: "", projectIndex: null, playing: [] })
    })
})
