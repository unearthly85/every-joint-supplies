import type { Styles } from "../../../types/Settings"
import type { Output } from "../../../types/Output"
import type { Display } from "../stage/screen"

/** The id the keyable style is stored under in the styles store, and the marker we use to find the keyable output. */
export const CHURCH_KEYABLE_STYLE_ID = "church_keyable"

/** The name FreeShow shows for the keyable output. */
export const CHURCH_KEYABLE_NAME = "Keyable"

/** The style that makes a slide keyable: only the slide layer, on a solid background of the key colour, so the text sits at the slide's normal position and a keyer can cut everything else out. */
export function keyableStyle(color: string): Styles {
    return {
        name: CHURCH_KEYABLE_NAME,
        layers: ["slide"],
        background: color
    }
}

/** The output settings that send the keyable slide to the chosen screen. Only these keys are set; everything else on the output stays as FreeShow gives it. */
export function keyableOutputPatch(display: Display, styleId: string): Partial<Output> {
    return {
        name: CHURCH_KEYABLE_NAME,
        enabled: true,
        active: true,
        color: "#000000",
        screen: String(display.id),
        bounds: { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height },
        style: styleId
    }
}

/** The id of the output that is the keyable output, if one exists (the first by id when several do), else null. */
export function churchKeyableOutputId(outputs: { [id: string]: Output }): string | null {
    const ids = Object.keys(outputs)
        .filter((id) => {
            const output = outputs[id]
            return output.enabled && !output.stageOutput && !output.ndi && !output.omt && !output.webrtc && !output.rtmp && output.style === CHURCH_KEYABLE_STYLE_ID
        })
        .sort()
    return ids.length > 0 ? ids[0] : null
}
