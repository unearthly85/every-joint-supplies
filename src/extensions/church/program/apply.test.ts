import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Output } from "../../../types/Output"
import type { Display } from "../stage/screen"
import { CHURCH_PROGRAM_NAME } from "./preset"

const addOutput = vi.fn()
const toggleOutputs = vi.fn()
const send = vi.fn()
const outputs = writable<{ [id: string]: Output }>({})
const activeRename = writable<string | null>(null)

vi.mock("../../../frontend/stores", () => ({
    outputs,
    activeRename
}))
vi.mock("../../../frontend/components/helpers/output", () => ({
    addOutput: (...args: unknown[]) => addOutput(...args),
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
        name: "Primary",
        color: "#F0008C",
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        screen: null,
        ...partial
    }
}

function display(id: number | string, bounds = { x: 1920, y: 0, width: 1920, height: 1080 }): Display {
    return { id, bounds }
}

/** Acts like the real addOutput: adds the output to the store with the given name and starts the rename. */
function fakeAddOutput() {
    addOutput.mockImplementation((_onlyFirst: boolean, _styleId: string, _enabled: boolean, name: string) => {
        const id = "program-new"
        outputs.update((all) => ({ ...all, [id]: { ...output(), name, id } }))
        activeRename.set("output_" + id)
        return id
    })
}

beforeEach(() => {
    addOutput.mockReset()
    toggleOutputs.mockReset()
    send.mockReset()
    outputs.set({})
    activeRename.set(null)
})

afterEach(() => {
    delete (globalThis as { __ejsTestClock?: boolean }).__ejsTestClock
    delete (globalThis as { __ejsProgramOutput?: () => unknown }).__ejsProgramOutput
})

describe("putting the program on a screen", () => {
    it("creates the program output when none exists, and clears the rename box", async () => {
        fakeAddOutput()
        outputs.set({ primary: output({ name: "Primary", screen: "1" }) })
        const { useScreenForProgram } = await import("./apply")
        const id = useScreenForProgram(display(2))
        expect(id).toBe("program-new")
        expect(addOutput).toHaveBeenCalledTimes(1)
        expect(addOutput).toHaveBeenCalledWith(false, "", true, CHURCH_PROGRAM_NAME)
        expect(toggleOutputs).not.toHaveBeenCalled()
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith("OUTPUT", ["UPDATE_BOUNDS"], { id: "program-new", ...get(outputs)["program-new"] })
        expect(get(outputs)["program-new"]).toMatchObject({
            name: "Program",
            enabled: true,
            active: true,
            screen: "2",
            bounds: { x: 1920, y: 0, width: 1920, height: 1080 }
        })
        expect(get(activeRename)).toBeNull()
    })

    it("reuses the program output when one exists, and does not create a new one", async () => {
        outputs.set({
            primary: output({ name: "Primary", screen: "1" }),
            program: output({ name: "Program", screen: "1", bounds: { x: 0, y: 0, width: 1920, height: 1080 } })
        })
        activeRename.set("output_something")
        const { useScreenForProgram } = await import("./apply")
        const id = useScreenForProgram(display(2))
        expect(id).toBe("program")
        expect(addOutput).not.toHaveBeenCalled()
        expect(toggleOutputs).toHaveBeenCalledTimes(1)
        expect(toggleOutputs).toHaveBeenCalledWith(["program"], { state: true })
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith("OUTPUT", ["UPDATE_BOUNDS"], { id: "program", ...get(outputs)["program"] })
        expect(get(outputs)["program"]).toMatchObject({
            name: "Program",
            screen: "2",
            bounds: { x: 1920, y: 0, width: 1920, height: 1080 }
        })
        expect(get(activeRename)).toBeNull()
    })

    it("creates it once, then reuses the program output on the second call", async () => {
        fakeAddOutput()
        outputs.set({ primary: output({ name: "Primary", screen: "1" }) })
        const { useScreenForProgram } = await import("./apply")
        const first = useScreenForProgram(display(2))
        const second = useScreenForProgram(display(3, { x: 2560, y: 0, width: 2560, height: 1440 }))
        expect(first).toBe("program-new")
        expect(second).toBe("program-new")
        expect(addOutput).toHaveBeenCalledTimes(1)
        expect(toggleOutputs).toHaveBeenCalledTimes(1)
        expect(toggleOutputs).toHaveBeenCalledWith(["program-new"], { state: true })
        expect(send).toHaveBeenCalledTimes(2)
        expect(get(outputs)["program-new"]).toMatchObject({
            name: "Program",
            screen: "3",
            bounds: { x: 2560, y: 0, width: 2560, height: 1440 }
        })
        expect(get(activeRename)).toBeNull()
    })

    it("never edits the primary output", async () => {
        fakeAddOutput()
        const primary = output({ name: "Primary", screen: "1" })
        outputs.set({ primary: { ...primary } })
        const { useScreenForProgram } = await import("./apply")
        useScreenForProgram(display(2))
        expect(get(outputs)["primary"]).toEqual(primary)
        useScreenForProgram(display(3, { x: 2560, y: 0, width: 2560, height: 1440 }))
        expect(get(outputs)["primary"]).toEqual(primary)
    })

    it("does not reuse a network output even when it is named Program", async () => {
        fakeAddOutput()
        const ndi = output({ name: "Program", ndi: true, screen: "2" })
        outputs.set({ ndi: { ...ndi } })
        const { useScreenForProgram } = await import("./apply")
        const id = useScreenForProgram(display(3))
        expect(id).toBe("program-new")
        expect(addOutput).toHaveBeenCalledTimes(1)
        expect(toggleOutputs).not.toHaveBeenCalled()
        expect(get(outputs)["ndi"]).toEqual(ndi)
        expect(get(activeRename)).toBeNull()
    })
})

describe("test hooks", () => {
    it("exposes the program output while the test clock is on", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        outputs.set({
            primary: output({ name: "Primary", screen: "1" }),
            program: output({ name: "Program", screen: "2" })
        })
        const { publishProgramScreenHooks } = await import("./apply")
        publishProgramScreenHooks()
        const page = globalThis as { __ejsProgramOutput?: () => { id: string; screen?: string | null } | null }
        expect(page.__ejsProgramOutput?.()).toEqual({ id: "program", ...get(outputs)["program"] })
    })

    it("reports a null program output when none exists", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        outputs.set({ primary: output({ name: "Primary", screen: "1" }) })
        const { publishProgramScreenHooks } = await import("./apply")
        publishProgramScreenHooks()
        const page = globalThis as { __ejsProgramOutput?: () => unknown }
        expect(page.__ejsProgramOutput?.()).toBeNull()
    })

    it("does not expose the hook while the test clock is off", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = false
        const { publishProgramScreenHooks } = await import("./apply")
        publishProgramScreenHooks()
        const page = globalThis as { __ejsProgramOutput?: unknown }
        expect(page.__ejsProgramOutput).toBeUndefined()
    })
})
