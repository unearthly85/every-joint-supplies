import { afterEach, describe, expect, it, vi } from "vitest"
import type { Output } from "../../../types/Output"
import { CHURCH_STAGE_ID } from "./layout"
import type { Display } from "./screen"
import { churchStageOutputId, displayInUse, displayLabel, listDisplays, programOutputIds, stageOutputPatch, stageScreenChoices } from "./screen"

function display(id: number | string, width = 1920, height = 1080, x = 0, y = 0): Display {
    return { id, bounds: { x, y, width, height } }
}

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

const A = display(1)
const B = display(2, 1280, 720)
const C = display(3, 2560, 1440)

describe("finding the program outputs", () => {
    it("lists the enabled local outputs, sorted by id", () => {
        const outputs = {
            program: output({ screen: "1" }),
            preview: output({ name: "Preview", screen: "2" })
        }
        expect(programOutputIds(outputs)).toEqual(["preview", "program"])
    })

    it("leaves out network, stage, and disabled outputs", () => {
        const outputs = {
            ndi: output({ ndi: true }),
            omt: output({ omt: true }),
            webrtc: output({ webrtc: true }),
            rtmp: output({ rtmp: true }),
            stage: output({ stageOutput: CHURCH_STAGE_ID }),
            off: output({ enabled: false })
        }
        expect(programOutputIds(outputs)).toEqual([])
    })

    it("keeps the local output when the others are not program outputs", () => {
        const outputs = {
            ndi: output({ ndi: true }),
            stage: output({ stageOutput: CHURCH_STAGE_ID }),
            off: output({ enabled: false }),
            program: output({ screen: "1" })
        }
        expect(programOutputIds(outputs)).toEqual(["program"])
    })
})

describe("telling if a screen is in use by an output", () => {
    it("is in use when the output names the screen", () => {
        expect(displayInUse(A, output({ screen: "1" }))).toBe(true)
    })

    it("matches a numeric screen id as a string", () => {
        expect(displayInUse(display(7), output({ screen: "7" }))).toBe(true)
    })

    it("is in use when the output has no screen and covers the whole screen", () => {
        expect(displayInUse(A, output({ screen: null, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }))).toBe(true)
    })

    it("is in use when the screen is empty and the bounds match", () => {
        expect(displayInUse(A, output({ screen: "", bounds: { x: 0, y: 0, width: 1920, height: 1080 } }))).toBe(true)
    })

    it("is not in use when the output names a different screen", () => {
        expect(displayInUse(A, output({ screen: "2" }))).toBe(false)
    })

    it("is not in use when the output has no screen and its bounds do not cover the screen", () => {
        expect(displayInUse(A, output({ screen: null, bounds: { x: 0, y: 0, width: 960, height: 540 } }))).toBe(false)
    })

    it("is not in use when only one bound differs", () => {
        const base = { x: 0, y: 0, width: 1920, height: 1080 }
        expect(displayInUse(A, output({ screen: null, bounds: { ...base, x: 100 } }))).toBe(false)
        expect(displayInUse(A, output({ screen: null, bounds: { ...base, y: 100 } }))).toBe(false)
        expect(displayInUse(A, output({ screen: null, bounds: { ...base, width: 960 } }))).toBe(false)
        expect(displayInUse(A, output({ screen: null, bounds: { ...base, height: 540 } }))).toBe(false)
    })
})

describe("choosing the screens the stage can use", () => {
    it("offers nothing when the one screen already shows the program", () => {
        expect(stageScreenChoices([A], { program: output({ screen: "1" }) })).toEqual([])
    })

    it("offers nothing when the one screen is covered by the program bounds", () => {
        expect(stageScreenChoices([A], { program: output({ screen: null }) })).toEqual([])
    })

    it("offers the free screen when the program is on the first, by screen id", () => {
        expect(stageScreenChoices([A, B], { program: output({ screen: "1" }) })).toEqual([B])
    })

    it("offers the free screen when the program is matched by bounds only", () => {
        expect(stageScreenChoices([A, B], { program: output({ screen: null, bounds: A.bounds }) })).toEqual([B])
    })

    it("keeps a screen that shows the church stage, since it is not a program output", () => {
        const outputs = {
            program: output({ screen: "1" }),
            stage: output({ stageOutput: CHURCH_STAGE_ID, screen: "3", bounds: C.bounds })
        }
        expect(stageScreenChoices([A, B, C], outputs)).toEqual([B, C])
    })

    it("excludes the first screen when there are no program outputs", () => {
        expect(stageScreenChoices([A, B, C], {})).toEqual([B, C])
    })

    it("excludes the first screen when the only output is disabled", () => {
        expect(stageScreenChoices([A, B], { program: output({ screen: "1", enabled: false }) })).toEqual([B])
    })

    it("offers every screen when the program output matches none of them", () => {
        expect(stageScreenChoices([A, B], { program: output({ screen: "9" }) })).toEqual([A, B])
    })
})

describe("finding the church stage output", () => {
    it("finds the output that shows the church stage", () => {
        const outputs = {
            program: output({ screen: "1" }),
            stage: output({ stageOutput: CHURCH_STAGE_ID, screen: "2" })
        }
        expect(churchStageOutputId(outputs)).toBe("stage")
    })

    it("returns the first id when several show the church stage", () => {
        const outputs = {
            second: output({ stageOutput: CHURCH_STAGE_ID }),
            first: output({ stageOutput: CHURCH_STAGE_ID })
        }
        expect(churchStageOutputId(outputs)).toBe("first")
    })

    it("returns null when no output shows the church stage", () => {
        expect(churchStageOutputId({ program: output({ screen: "1" }) })).toBeNull()
        expect(churchStageOutputId({})).toBeNull()
    })
})

describe("patching an output to show the stage", () => {
    it("sets only the stage keys, with the screen as a string", () => {
        const patch = stageOutputPatch(B)
        expect(patch).toEqual({
            stageOutput: CHURCH_STAGE_ID,
            name: "Stage",
            enabled: true,
            active: true,
            screen: "2",
            bounds: { x: 0, y: 0, width: 1280, height: 720 }
        })
        expect(Object.keys(patch).sort()).toEqual(["active", "bounds", "enabled", "name", "screen", "stageOutput"])
        expect(typeof patch.screen).toBe("string")
    })

    it("stringifies a numeric screen id and copies the bounds", () => {
        const patch = stageOutputPatch(display(3, 2560, 1440, 1280, 0))
        expect(patch.screen).toBe("3")
        expect(patch.bounds).toEqual({ x: 1280, y: 0, width: 2560, height: 1440 })
    })

    it("does not touch the display it was given", () => {
        const d = display(4)
        const before = structuredClone(d)
        stageOutputPatch(d)
        expect(d).toEqual(before)
    })
})

describe("naming a screen in plain words", () => {
    it("uses the screen's label when it has one", () => {
        expect(displayLabel({ ...A, label: "Booth monitor" }, 0)).toBe("Booth monitor (1920×1080)")
    })

    it("counts the screen when it has no label", () => {
        expect(displayLabel(A, 0)).toBe("Screen 1 (1920×1080)")
        expect(displayLabel(B, 1)).toBe("Screen 2 (1280×720)")
    })
})

describe("listing the screens", () => {
    afterEach(() => {
        delete (globalThis as { __ejsTestClock?: boolean }).__ejsTestClock
        delete (globalThis as { __ejsFakeDisplays?: Display[] }).__ejsFakeDisplays
    })

    it("returns the fake screens when the test clock is on and a fake list is set", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        const fake = [display(9, 1024, 768, 500, 50)]
        ;(globalThis as { __ejsFakeDisplays?: Display[] }).__ejsFakeDisplays = fake
        const request = vi.fn(async () => [A, B])
        expect(await listDisplays(request)).toEqual(fake)
        expect(request).not.toHaveBeenCalled()
    })

    it("asks for the real screens when the test clock is on but no fake list is set", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        const request = vi.fn(async () => [A, B])
        expect(await listDisplays(request)).toEqual([A, B])
        expect(request).toHaveBeenCalledTimes(1)
    })

    it("asks for the real screens when the test clock is off, even with a fake list set", async () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = false
        ;(globalThis as { __ejsFakeDisplays?: Display[] }).__ejsFakeDisplays = [display(9)]
        const request = vi.fn(async () => [A, B])
        expect(await listDisplays(request)).toEqual([A, B])
        expect(request).toHaveBeenCalledTimes(1)
    })

    it("returns nothing when the request comes back empty", async () => {
        expect(await listDisplays(async () => undefined)).toEqual([])
    })
})
