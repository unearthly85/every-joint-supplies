import { writable } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"

const setOutput = vi.fn()
const openProjectItem = vi.fn()
const audioStart = vi.fn()
const projects = writable<Record<string, { shows: any[] }>>({})
const activeProject = writable<string | null>("sunday")
const showsCache = writable<Record<string, { settings: { activeLayout: string } }>>({
    show1: { settings: { activeLayout: "arrangement" } }
})

vi.mock("../../../frontend/stores", () => ({
    activeProject,
    projects,
    showsCache,
    outputs: writable({}),
    playingVideos: writable([]),
    groups: {
        subscribe(run: (value: object) => void) {
            run({})
            return () => undefined
        },
        set: () => undefined
    }
}))
vi.mock("../../../frontend/components/helpers/output", () => ({
    getAllActiveOutputIds: () => ["out"],
    setOutput: (...args: unknown[]) => setOutput(...args)
}))
vi.mock("../../../frontend/components/helpers/media", () => ({
    getMedia: async (path: string) => ({ path })
}))
vi.mock("../../../frontend/audio/audioPlayer", () => ({
    AudioPlayer: { start: (...args: unknown[]) => audioStart(...args) }
}))
vi.mock("../../../frontend/components/show/project", () => ({
    openProjectItem: (...args: unknown[]) => openProjectItem(...args)
}))
vi.mock("../../../frontend/utils/common", () => ({
    isMainWindow: () => true
}))

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
