import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Output } from "../../../types/Output"
import type { Styles } from "../../../types/Settings"
import type { Display } from "../stage/screen"
import { CHURCH_KEYABLE_NAME, CHURCH_KEYABLE_STYLE_ID, keyableStyle } from "./preset"

const addOutput = vi.fn()
const toggleOutputs = vi.fn()
const send = vi.fn()
const outputs = writable<{ [id: string]: Output }>({})
const styles = writable<{ [key: string]: Styles }>({})
const activeRename = writable<string | null>(null)

vi.mock("../../../frontend/stores", () => ({
    outputs,
    styles,
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
        name: "Output",
        color: "#000000",
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        screen: null,
        ...partial
    }
}

function display(id: number | string, bounds = { x: 3840, y: 0, width: 1920, height: 1080 }): Display {
    return { id, bounds }
}

/** Acts like the real addOutput: adds the output to the store and starts the rename. */
function fakeAddOutput() {
    addOutput.mockImplementation((_onlyFirst: boolean, styleId: string, _enabled: boolean, name: string) => {
        const id = "keyable-new"
        outputs.update((all) => ({ ...all, [id]: { ...output(), ...(styleId ? { style: styleId } : {}), ...(name ? { name } : {}), id } }))
        activeRename.set("output_" + id)
        return id
    })
}

beforeEach(() => {
    addOutput.mockReset()
    toggleOutputs.mockReset()
    send.mockReset()
    outputs.set({})
    styles.set({})
    activeRename.set(null)
})

afterEach(() => {
    delete (globalThis as { __ejsTestClock?: boolean }).__ejsTestClock
    delete (globalThis as { __ejsKeyableOutput?: () => unknown }).__ejsKeyableOutput
    delete (globalThis as { __ejsKeyableStyle?: () => unknown }).__ejsKeyableStyle
})

describe("turning the keyable lower-thirds on", () => {
    it("creates the keyable style when it is missing", async () => {
        fakeAddOutput()
        const { enableKeyable } = await import("./apply")
        enableKeyable(display(3))
        expect(get(styles)[CHURCH_KEYABLE_STYLE_ID]).toEqual(keyableStyle("#00FF00"))
    })

    it("reuses the keyable style when it is present", async () => {
        fakeAddOutput()
        const existing = keyableStyle("#000000")
        styles.set({ [CHURCH_KEYABLE_STYLE_ID]: existing })
        const { enableKeyable } = await import("./apply")
        enableKeyable(display(3))
        expect(get(styles)[CHURCH_KEYABLE_STYLE_ID]).toBe(existing)
    })

    it("uses the given key colour for a new style", async () => {
        fakeAddOutput()
        const { enableKeyable } = await import("./apply")
        enableKeyable(display(3), "#000000")
        expect(get(styles)[CHURCH_KEYABLE_STYLE_ID]).toEqual(keyableStyle("#000000"))
    })

    it("reuses an existing keyable output: applies the patch, toggles it on, sends UPDATE_BOUNDS", async () => {
        outputs.set({
            program: output({ name: "Program", screen: "1" }),
            keyable: output({ name: "Old key", style: CHURCH_KEYABLE_STYLE_ID, screen: "2", bounds: { x: 1920, y: 0, width: 1920, height: 1080 } })
        })
        const { enableKeyable } = await import("./apply")
        const id = enableKeyable(display(3))
        expect(id).toBe("keyable")
        expect(addOutput).not.toHaveBeenCalled()
        expect(toggleOutputs).toHaveBeenCalledTimes(1)
        expect(toggleOutputs).toHaveBeenCalledWith(["keyable"], { state: true })
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith("OUTPUT", ["UPDATE_BOUNDS"], { id: "keyable", ...get(outputs)["keyable"] })
        expect(get(outputs)["keyable"]).toMatchObject({
            name: CHURCH_KEYABLE_NAME,
            enabled: true,
            active: true,
            screen: "3",
            bounds: { x: 3840, y: 0, width: 1920, height: 1080 },
            style: CHURCH_KEYABLE_STYLE_ID
        })
        expect(get(activeRename)).toBeNull()
    })

    it("creates the keyable output when none exists, and clears the rename box", async () => {
        fakeAddOutput()
        outputs.set({ program: output({ name: "Program", screen: "1" }) })
        const { enableKeyable } = await import("./apply")
        const id = enableKeyable(display(3))
        expect(id).toBe("keyable-new")
        expect(addOutput).toHaveBeenCalledTimes(1)
        expect(addOutput).toHaveBeenCalledWith(false, CHURCH_KEYABLE_STYLE_ID, true, CHURCH_KEYABLE_NAME)
        expect(toggleOutputs).not.toHaveBeenCalled()
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith("OUTPUT", ["UPDATE_BOUNDS"], { id: "keyable-new", ...get(outputs)["keyable-new"] })
        expect(get(outputs)["keyable-new"]).toMatchObject({
            name: CHURCH_KEYABLE_NAME,
            screen: "3",
            bounds: { x: 3840, y: 0, width: 1920, height: 1080 },
            style: CHURCH_KEYABLE_STYLE_ID
        })
        expect(get(activeRename)).toBeNull()
        expect(get(outputs)["program"]).toMatchObject({ name: "Program", screen: "1" })
    })
})

describe("turning the keyable lower-thirds off", () => {
    it("removes the keyable output, sends REMOVE, and leaves the style in place", async () => {
        const style = keyableStyle("#00FF00")
        styles.set({ [CHURCH_KEYABLE_STYLE_ID]: style })
        outputs.set({
            program: output({ name: "Program", screen: "1" }),
            keyable: output({ name: "Keyable", style: CHURCH_KEYABLE_STYLE_ID, screen: "3" })
        })
        const { disableKeyable } = await import("./apply")
        disableKeyable()
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith("OUTPUT", ["REMOVE"], { id: "keyable" })
        expect(get(outputs)).not.toHaveProperty("keyable")
        expect(get(outputs)).toMatchObject({ program: expect.objectContaining({ name: "Program", screen: "1" }) })
        expect(get(styles)[CHURCH_KEYABLE_STYLE_ID]).toBe(style)
    })

    it("does nothing when there is no keyable output", async () => {
        outputs.set({ program: output({ name: "Program", screen: "1" }) })
        const before = get(outputs)
        const { disableKeyable } = await import("./apply")
        disableKeyable()
        expect(send).not.toHaveBeenCalled()
        expect(get(outputs)).toBe(before)
    })
})

describe("test hooks", () => {
    it("exposes the keyable output and the keyable style while the test clock is on", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        const style = keyableStyle("#00FF00")
        styles.set({ [CHURCH_KEYABLE_STYLE_ID]: style })
        outputs.set({
            program: output({ name: "Program", screen: "1" }),
            keyable: output({ name: "Keyable", style: CHURCH_KEYABLE_STYLE_ID, screen: "3" })
        })
        const { publishKeyableHooks } = await import("./apply")
        publishKeyableHooks()
        const page = globalThis as { __ejsKeyableOutput?: () => { id: string; screen?: string | null } | null; __ejsKeyableStyle?: () => Styles | null }
        expect(page.__ejsKeyableOutput?.()).toEqual({ id: "keyable", ...get(outputs)["keyable"] })
        expect(page.__ejsKeyableStyle?.()).toEqual(style)
    })

    it("reports null when the keyable output or the keyable style is missing", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        outputs.set({ program: output({ name: "Program", screen: "1" }) })
        const { publishKeyableHooks } = await import("./apply")
        publishKeyableHooks()
        const page = globalThis as { __ejsKeyableOutput?: () => unknown; __ejsKeyableStyle?: () => unknown }
        expect(page.__ejsKeyableOutput?.()).toBeNull()
        expect(page.__ejsKeyableStyle?.()).toBeNull()
    })

    it("does not expose the hooks while the test clock is off", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = false
        const { publishKeyableHooks } = await import("./apply")
        publishKeyableHooks()
        const page = globalThis as { __ejsKeyableOutput?: unknown; __ejsKeyableStyle?: unknown }
        expect(page.__ejsKeyableOutput).toBeUndefined()
        expect(page.__ejsKeyableStyle).toBeUndefined()
    })
})
