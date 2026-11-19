import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Output } from "../../../types/Output"
import { CHURCH_STAGE_ID } from "./layout"
import type { Display } from "./screen"

const enableStageOutput = vi.fn()
const toggleOutputs = vi.fn()
const send = vi.fn()
const outputs = writable<{ [id: string]: Output }>({})
const activeRename = writable<string | null>(null)

vi.mock("../../../frontend/stores", () => ({
    outputs,
    activeRename
}))
vi.mock("../../../frontend/components/helpers/output", () => ({
    enableStageOutput: (...args: unknown[]) => enableStageOutput(...args),
    toggleOutputs: (...args: unknown[]) => toggleOutputs(...args)
}))
vi.mock("../../../frontend/utils/request", () => ({
    send: (...args: unknown[]) => send(...args)
}))
vi.mock("../../../types/Channels", () => ({
    OUTPUT: "OUTPUT"
}))

function output(partial: Partial<Output> = {}): Output {
    return {
        enabled: true,
        active: true,
        name: "Program",
        color: "#000000",
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        screen: null,
        ...partial
    }
}

function display(id: number | string, bounds = { x: 1920, y: 0, width: 1920, height: 1080 }): Display {
    return { id, bounds }
}

/** Acts like the real enableStageOutput: adds the output to the store and starts the rename. */
function fakeEnableStageOutput() {
    enableStageOutput.mockImplementation((patch: Partial<Output>) => {
        const id = "stage-new"
        outputs.update((all) => ({ ...all, [id]: { ...output(), ...patch, id } }))
        activeRename.set("output_" + id)
        return id
    })
}

beforeEach(() => {
    enableStageOutput.mockReset()
    toggleOutputs.mockReset()
    send.mockReset()
    outputs.set({})
    activeRename.set(null)
})

afterEach(() => {
    delete (globalThis as { __ejsTestClock?: boolean }).__ejsTestClock
    delete (globalThis as { __ejsStageOutput?: () => unknown }).__ejsStageOutput
    delete (globalThis as { __ejsProgramOutputs?: () => unknown }).__ejsProgramOutputs
})

describe("putting the stage on a screen", () => {
    it("creates the stage output when none exists, and clears the rename box", async () => {
        fakeEnableStageOutput()
        const { useScreenForStage } = await import("./apply")
        const id = useScreenForStage(display(2))
        expect(id).toBe("stage-new")
        expect(enableStageOutput).toHaveBeenCalledTimes(1)
        expect(enableStageOutput).toHaveBeenCalledWith({
            stageOutput: CHURCH_STAGE_ID,
            name: "Stage",
            enabled: true,
            active: true,
            screen: "2",
            bounds: { x: 1920, y: 0, width: 1920, height: 1080 }
        })
        expect(toggleOutputs).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(get(activeRename)).toBeNull()
    })

    it("creates it once, then reuses the stage output on the second call", async () => {
        fakeEnableStageOutput()
        const { useScreenForStage } = await import("./apply")
        const first = useScreenForStage(display(2))
        const second = useScreenForStage(display(3, { x: 2560, y: 0, width: 2560, height: 1440 }))
        expect(first).toBe("stage-new")
        expect(second).toBe("stage-new")
        expect(enableStageOutput).toHaveBeenCalledTimes(1)
        expect(toggleOutputs).toHaveBeenCalledTimes(1)
        expect(toggleOutputs).toHaveBeenCalledWith(["stage-new"], { state: true })
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith("OUTPUT", ["UPDATE_BOUNDS"], { id: "stage-new", ...get(outputs)["stage-new"] })
        expect(get(outputs)["stage-new"]).toMatchObject({
            stageOutput: CHURCH_STAGE_ID,
            screen: "3",
            bounds: { x: 2560, y: 0, width: 2560, height: 1440 }
        })
    })

    it("moves an existing stage output to the chosen screen", async () => {
        outputs.set({
            program: output({ name: "Program", screen: "1" }),
            stage: output({ name: "Old stage", stageOutput: CHURCH_STAGE_ID, screen: "3", bounds: { x: 2560, y: 0, width: 2560, height: 1440 } })
        })
        const { useScreenForStage } = await import("./apply")
        const id = useScreenForStage(display(2))
        expect(id).toBe("stage")
        expect(enableStageOutput).not.toHaveBeenCalled()
        expect(toggleOutputs).toHaveBeenCalledWith(["stage"], { state: true })
        expect(send).toHaveBeenCalledWith("OUTPUT", ["UPDATE_BOUNDS"], { id: "stage", ...get(outputs)["stage"] })
        expect(get(outputs)["stage"]).toMatchObject({
            name: "Stage",
            screen: "2",
            bounds: { x: 1920, y: 0, width: 1920, height: 1080 }
        })
    })

    it("never edits a program output", async () => {
        fakeEnableStageOutput()
        const program = output({ name: "Program", screen: "1" })
        outputs.set({ program: { ...program } })
        const { useScreenForStage } = await import("./apply")
        useScreenForStage(display(2))
        expect(get(outputs)["program"]).toEqual(program)
        useScreenForStage(display(3, { x: 2560, y: 0, width: 2560, height: 1440 }))
        expect(get(outputs)["program"]).toEqual(program)
    })
})

describe("test hooks", () => {
    it("exposes the stage output and the program outputs while the test clock is on", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        outputs.set({
            program: output({ name: "Program", screen: "1" }),
            stage: output({ name: "Stage", stageOutput: CHURCH_STAGE_ID, screen: "2" }),
            ndi: output({ name: "NDI", ndi: true, screen: "3" })
        })
        const { publishStageScreenHooks } = await import("./apply")
        publishStageScreenHooks()
        const page = globalThis as { __ejsStageOutput?: () => { id: string; screen?: string | null } | null; __ejsProgramOutputs?: () => { id: string; screen: string | null; bounds: { x: number; y: number; width: number; height: number } }[] }
        expect(page.__ejsStageOutput?.()).toEqual({ id: "stage", ...get(outputs)["stage"] })
        expect(page.__ejsProgramOutputs?.()).toEqual([{ id: "program", screen: "1", bounds: get(outputs)["program"].bounds }])
    })

    it("reports a null stage output when none exists", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        outputs.set({ program: output({ name: "Program", screen: "1" }) })
        const { publishStageScreenHooks } = await import("./apply")
        publishStageScreenHooks()
        const page = globalThis as { __ejsStageOutput?: () => unknown }
        expect(page.__ejsStageOutput?.()).toBeNull()
    })

    it("does not expose the hooks while the test clock is off", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = false
        const { publishStageScreenHooks } = await import("./apply")
        publishStageScreenHooks()
        const page = globalThis as { __ejsStageOutput?: unknown; __ejsProgramOutputs?: unknown }
        expect(page.__ejsStageOutput).toBeUndefined()
        expect(page.__ejsProgramOutputs).toBeUndefined()
    })
})
