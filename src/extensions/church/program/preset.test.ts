import { describe, expect, it } from "vitest"
import type { Output } from "../../../types/Output"
import { CHURCH_STAGE_ID } from "../stage/layout"
import type { Display } from "../stage/screen"
import { CHURCH_PROGRAM_NAME, churchProgramOutputId, programOutputPatch, programScreenChoices } from "./preset"

function display(id: number | string, width = 1920, height = 1080, x = 0, y = 0): Display {
    return { id, bounds: { x, y, width, height } }
}

function output(partial: Partial<Output> = {}): Output {
    return {
        enabled: true,
        active: true,
        name: CHURCH_PROGRAM_NAME,
        color: "#000000",
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        screen: null,
        ...partial
    }
}

const A = display(1)
const B = display(2, 1280, 720)
const C = display(3, 2560, 1440)

describe("the program name", () => {
    it("is the plain word Program", () => {
        expect(CHURCH_PROGRAM_NAME).toBe("Program")
    })
})

describe("patching an output to show the clean program", () => {
    it("sets only the program keys, with the screen as a string", () => {
        const patch = programOutputPatch(B)
        expect(patch).toEqual({
            name: CHURCH_PROGRAM_NAME,
            enabled: true,
            active: true,
            color: "#000000",
            screen: "2",
            bounds: { x: 0, y: 0, width: 1280, height: 720 }
        })
        expect(Object.keys(patch).sort()).toEqual(["active", "bounds", "color", "enabled", "name", "screen"])
        expect(typeof patch.screen).toBe("string")
    })

    it("does not set stage, network, or style keys", () => {
        const patch = programOutputPatch(B)
        expect(patch).not.toHaveProperty("stageOutput")
        expect(patch).not.toHaveProperty("ndi")
        expect(patch).not.toHaveProperty("omt")
        expect(patch).not.toHaveProperty("webrtc")
        expect(patch).not.toHaveProperty("rtmp")
        expect(patch).not.toHaveProperty("style")
    })

    it("stringifies a numeric screen id and copies the bounds", () => {
        const patch = programOutputPatch(display(3, 2560, 1440, 1280, 0))
        expect(patch.screen).toBe("3")
        expect(patch.bounds).toEqual({ x: 1280, y: 0, width: 2560, height: 1440 })
    })

    it("does not touch the display it was given", () => {
        const d = display(4)
        const before = structuredClone(d)
        programOutputPatch(d)
        expect(d).toEqual(before)
    })
})

describe("finding the church program output", () => {
    it("finds the enabled local output named Program", () => {
        const outputs = {
            program: output({ screen: "1" }),
            stage: output({ name: "Stage", stageOutput: CHURCH_STAGE_ID, screen: "2" }),
            ndi: output({ name: "NDI", ndi: true, screen: "3" }),
            rtmp: output({ name: "Stream", rtmp: true }),
            other: output({ name: "Other", screen: "4" })
        }
        expect(churchProgramOutputId(outputs)).toBe("program")
    })

    it("ignores a stage output named Program", () => {
        const outputs = {
            stage: output({ name: CHURCH_PROGRAM_NAME, stageOutput: CHURCH_STAGE_ID, screen: "2" })
        }
        expect(churchProgramOutputId(outputs)).toBeNull()
    })

    it("ignores network outputs named Program", () => {
        const outputs = {
            ndi: output({ ndi: true }),
            omt: output({ omt: true }),
            webrtc: output({ webrtc: true }),
            rtmp: output({ rtmp: true })
        }
        expect(churchProgramOutputId(outputs)).toBeNull()
    })

    it("ignores a local output with a different name", () => {
        const outputs = {
            other: output({ name: "Output", screen: "1" })
        }
        expect(churchProgramOutputId(outputs)).toBeNull()
    })

    it("ignores a disabled output named Program", () => {
        const outputs = {
            program: output({ enabled: false, screen: "1" })
        }
        expect(churchProgramOutputId(outputs)).toBeNull()
    })

    it("returns null when nothing matches", () => {
        expect(churchProgramOutputId({})).toBeNull()
        expect(churchProgramOutputId({ other: output({ name: "Output" }) })).toBeNull()
    })

    it("returns the first id when several match", () => {
        const outputs = {
            second: output({ screen: "2" }),
            first: output({ screen: "1" })
        }
        expect(churchProgramOutputId(outputs)).toBe("first")
    })
})

describe("choosing the screens the program can use", () => {
    it("leaves out the screen a program output names", () => {
        expect(programScreenChoices([A, B, C], { program: output({ screen: "1" }) })).toEqual([B, C])
    })

    it("leaves out a screen covered by the program bounds", () => {
        expect(programScreenChoices([A, B, C], { program: output({ screen: null, bounds: A.bounds }) })).toEqual([B, C])
    })

    it("leaves out the screen the stage output names", () => {
        const outputs = {
            program: output({ screen: "1" }),
            stage: output({ name: "Stage", stageOutput: CHURCH_STAGE_ID, screen: "3", bounds: C.bounds })
        }
        expect(programScreenChoices([A, B, C], outputs)).toEqual([B])
    })

    it("keeps the rest in the order the screens were listed", () => {
        const outputs = {
            program: output({ screen: "3", bounds: C.bounds })
        }
        expect(programScreenChoices([C, A, B], outputs)).toEqual([A, B])
    })

    it("leaves out only the first screen when there are no program outputs", () => {
        expect(programScreenChoices([A, B, C], {})).toEqual([B, C])
    })

    it("leaves out the first screen and the stage screen when the only output is the stage", () => {
        const outputs = {
            stage: output({ name: "Stage", stageOutput: CHURCH_STAGE_ID, screen: "2", bounds: B.bounds })
        }
        expect(programScreenChoices([A, B, C], outputs)).toEqual([C])
    })

    it("leaves out the first screen when the only program output is disabled", () => {
        expect(programScreenChoices([A, B], { program: output({ screen: "1", enabled: false }) })).toEqual([B])
    })
})
