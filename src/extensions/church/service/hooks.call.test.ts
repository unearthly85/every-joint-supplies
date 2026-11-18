import { beforeEach, describe, expect, it, vi } from "vitest"

const listeners = () => undefined
;(globalThis as { AudioWorkletNode?: unknown }).AudioWorkletNode = class AudioWorkletNode {}
;(globalThis as { AudioContext?: unknown }).AudioContext = class {
    state = "running"
    resume() {
        return Promise.resolve()
    }
}
;(globalThis as { window?: unknown }).window = {
    addEventListener: listeners,
    removeEventListener: listeners,
    location: { href: "" },
    navigator: { userAgent: "" }
}
;(globalThis as { document?: unknown }).document = {
    addEventListener: listeners,
    removeEventListener: listeners,
    documentElement: { style: {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    querySelector: () => null,
    body: { appendChild() {} }
}

const note = vi.fn()
const ended = vi.fn(() => true)

vi.mock("pdfjs-dist", () => ({
    getDocument: () => ({}),
    GlobalWorkerOptions: {}
}))
vi.mock("../../../frontend/components/edit/scripts/itemHelpers", () => ({
    getDynamicValue: () => "",
    DEFAULT_ITEM_STYLE: ""
}))
vi.mock("../../../frontend/utils/language", () => ({
    translateText: (key: string) => key
}))
vi.mock("./session", () => ({
    churchNoteManual: (...args: unknown[]) => note(...args),
    churchOnMediaEnded: (id?: string) => ended(id)
}))

describe("FreeShow hooks call the Sunday session", () => {
    beforeEach(() => {
        note.mockClear()
        ended.mockClear()
    })

    it("lets a locked output through and notes a move onto another project item", async () => {
        const stores = await import("../../../frontend/stores")
        const { OutputHelper } = await import("../../../frontend/components/helpers/OutputHelper")

        stores.outLocked.set(true)
        OutputHelper.advanceOutput("main", "ArrowRight")
        expect(note).not.toHaveBeenCalled()

        stores.outLocked.set(false)
        stores.focusMode.set(false)
        stores.activeProject.set("sunday")
        stores.activeShow.set(null)
        stores.projects.set({ sunday: { shows: [{ id: "welcome", type: "show" }, { id: "next", type: "show" }] } })
        stores.outputs.set({ main: { enabled: true, active: true, out: {} } })
        OutputHelper.advanceOutput("main", "ArrowRight")
        expect(note).toHaveBeenCalledWith({ projectIndex: 0 })

        note.mockClear()
        OutputHelper.advanceOutput("main", "ArrowRight", { playNext: true })
        expect(note).not.toHaveBeenCalled()
    })

    it("lets a slide click and an item double-click note a move only when they are not blocked", async () => {
        const { noteItemDoubleClick, noteSlideClick } = await import("./hooks")
        noteSlideClick(true, { projectIndex: 1, showId: "welcome" })
        noteItemDoubleClick(true, { projectIndex: 4, showId: "announcements" })
        expect(note).not.toHaveBeenCalled()
        noteSlideClick(false, { projectIndex: null, showId: "welcome" })
        noteItemDoubleClick(false, { projectIndex: 4, showId: "announcements" })
        expect(note).toHaveBeenNthCalledWith(1, { projectIndex: null, showId: "welcome" })
        expect(note).toHaveBeenNthCalledWith(2, { projectIndex: 4, showId: "announcements" })
    })

    it("asks the session when media ends and the slide did not already advance", async () => {
        const stores = await import("../../../frontend/stores")
        const { checkNextAfterMedia } = await import("../../../frontend/components/helpers/showActions")
        stores.outputs.set({ main: { enabled: true, active: true, out: { background: { path: "/videos/countdown.mp4" } } } })
        const advanced = await checkNextAfterMedia("/videos/countdown.mp4", "media", "main")
        expect(ended).toHaveBeenCalledWith("/videos/countdown.mp4")
        expect(advanced).toBe(true)
    })
})
