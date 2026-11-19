import { describe, expect, it } from "vitest"
import type { Output } from "../../../types/Output"
import { CHURCH_STAGE_ID } from "../stage/layout"
import type { Display } from "../stage/screen"
import { CHURCH_KEYABLE_NAME, CHURCH_KEYABLE_STYLE_ID, churchKeyableOutputId, keyableOutputPatch, keyableStyle } from "./preset"

function display(id: number | string, width = 1920, height = 1080, x = 0, y = 0): Display {
    return { id, bounds: { x, y, width, height } }
}

function output(partial: Partial<Output> = {}): Output {
    return {
        enabled: true,
        active: true,
        name: CHURCH_KEYABLE_NAME,
        color: "#000000",
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        screen: null,
        ...partial
    }
}

const A = display(1)
const B = display(2, 1280, 720)
const C = display(3, 2560, 1440, 1280, 0)

describe("the keyable name and style id", () => {
    it("is the plain word Keyable", () => {
        expect(CHURCH_KEYABLE_NAME).toBe("Keyable")
    })

    it("stores the style under the church_keyable id", () => {
        expect(CHURCH_KEYABLE_STYLE_ID).toBe("church_keyable")
    })
})

describe("building the keyable style", () => {
    it("shows only the slide layer on the key colour", () => {
        expect(keyableStyle("#00FF00")).toEqual({ name: "Keyable", layers: ["slide"], background: "#00FF00" })
    })

    it("takes a chroma (green) key colour", () => {
        const style = keyableStyle("#00FF00")
        expect(style.name).toBe("Keyable")
        expect(style.layers).toEqual(["slide"])
        expect(style.background).toBe("#00FF00")
    })

    it("takes a luma (black) key colour", () => {
        const style = keyableStyle("#000000")
        expect(style.name).toBe("Keyable")
        expect(style.layers).toEqual(["slide"])
        expect(style.background).toBe("#000000")
    })

    it("does not use a template", () => {
        expect(keyableStyle("#00FF00")).not.toHaveProperty("template")
    })

    it("sets only the name, layers, and background keys", () => {
        expect(Object.keys(keyableStyle("#00FF00")).sort()).toEqual(["background", "layers", "name"])
    })
})

describe("patching an output to show the keyable slide", () => {
    it("sets the keyable keys, with the screen as a string", () => {
        const patch = keyableOutputPatch(B, CHURCH_KEYABLE_STYLE_ID)
        expect(patch).toEqual({
            name: CHURCH_KEYABLE_NAME,
            enabled: true,
            active: true,
            color: "#000000",
            screen: "2",
            bounds: { x: 0, y: 0, width: 1280, height: 720 },
            style: CHURCH_KEYABLE_STYLE_ID
        })
        expect(Object.keys(patch).sort()).toEqual(["active", "bounds", "color", "enabled", "name", "screen", "style"])
        expect(typeof patch.screen).toBe("string")
    })

    it("does not set stage or network keys", () => {
        const patch = keyableOutputPatch(B, CHURCH_KEYABLE_STYLE_ID)
        expect(patch).not.toHaveProperty("stageOutput")
        expect(patch).not.toHaveProperty("ndi")
        expect(patch).not.toHaveProperty("omt")
        expect(patch).not.toHaveProperty("webrtc")
        expect(patch).not.toHaveProperty("rtmp")
    })

    it("stringifies a numeric screen id and copies the bounds", () => {
        const patch = keyableOutputPatch(C, CHURCH_KEYABLE_STYLE_ID)
        expect(patch.screen).toBe("3")
        expect(patch.bounds).toEqual({ x: 1280, y: 0, width: 2560, height: 1440 })
    })

    it("does not touch the display it was given", () => {
        const d = display(4)
        const before = structuredClone(d)
        keyableOutputPatch(d, CHURCH_KEYABLE_STYLE_ID)
        expect(d).toEqual(before)
    })
})

describe("finding the keyable output", () => {
    it("finds the enabled local output with the keyable style", () => {
        const outputs = {
            keyable: output({ style: CHURCH_KEYABLE_STYLE_ID, screen: "1" }),
            stage: output({ name: "Stage", stageOutput: CHURCH_STAGE_ID, screen: "2" }),
            ndi: output({ name: "NDI", ndi: true, style: CHURCH_KEYABLE_STYLE_ID, screen: "3" }),
            rtmp: output({ name: "Stream", rtmp: true, style: CHURCH_KEYABLE_STYLE_ID }),
            other: output({ name: "Other", screen: "4" })
        }
        expect(churchKeyableOutputId(outputs)).toBe("keyable")
    })

    it("ignores a stage output with the keyable style", () => {
        const outputs = {
            stage: output({ stageOutput: CHURCH_STAGE_ID, style: CHURCH_KEYABLE_STYLE_ID, screen: "2" })
        }
        expect(churchKeyableOutputId(outputs)).toBeNull()
    })

    it("ignores network outputs with the keyable style", () => {
        const outputs = {
            ndi: output({ ndi: true, style: CHURCH_KEYABLE_STYLE_ID }),
            omt: output({ omt: true, style: CHURCH_KEYABLE_STYLE_ID }),
            webrtc: output({ webrtc: true, style: CHURCH_KEYABLE_STYLE_ID }),
            rtmp: output({ rtmp: true, style: CHURCH_KEYABLE_STYLE_ID })
        }
        expect(churchKeyableOutputId(outputs)).toBeNull()
    })

    it("ignores a local output with a different style", () => {
        const outputs = {
            other: output({ name: "Output", style: "some_other_style", screen: "1" })
        }
        expect(churchKeyableOutputId(outputs)).toBeNull()
    })

    it("ignores a local output with no style", () => {
        const outputs = {
            plain: output({ name: "Output", screen: "1" })
        }
        expect(churchKeyableOutputId(outputs)).toBeNull()
    })

    it("ignores a disabled output with the keyable style", () => {
        const outputs = {
            keyable: output({ style: CHURCH_KEYABLE_STYLE_ID, enabled: false, screen: "1" })
        }
        expect(churchKeyableOutputId(outputs)).toBeNull()
    })

    it("returns null when nothing matches", () => {
        expect(churchKeyableOutputId({})).toBeNull()
        expect(churchKeyableOutputId({ other: output({ name: "Output" }) })).toBeNull()
    })

    it("returns the first id when several match", () => {
        const outputs = {
            second: output({ style: CHURCH_KEYABLE_STYLE_ID, screen: "2" }),
            first: output({ style: CHURCH_KEYABLE_STYLE_ID, screen: "1" })
        }
        expect(churchKeyableOutputId(outputs)).toBe("first")
    })
})
