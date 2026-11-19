import type { Output } from "../../../types/Output"
import { CHURCH_STAGE_ID } from "./layout"

/** A screen as FreeShow reports it (Electron's screen API, GET_DISPLAYS). */
export interface Display {
    id: number | string
    bounds: { x: number; y: number; width: number; height: number }
    internal?: boolean
    label?: string
}

/** The ids of the outputs that show the program on a screen: enabled, not stage outputs, and not network-only. Sorted by id so the result is stable. */
export function programOutputIds(outputs: { [id: string]: Output }): string[] {
    return Object.keys(outputs)
        .filter((id) => {
            const output = outputs[id]
            return output.enabled && !output.stageOutput && !output.ndi && !output.omt && !output.webrtc && !output.rtmp
        })
        .sort()
}

/** True when the output would show on this screen: it names the screen, or (with no screen set) its bounds cover the whole screen. */
export function displayInUse(display: Display, output: Output): boolean {
    if (output.screen === String(display.id)) return true
    if (output.screen) return false
    return output.bounds.x === display.bounds.x && output.bounds.y === display.bounds.y && output.bounds.width === display.bounds.width && output.bounds.height === display.bounds.height
}

/** The screens a volunteer can pick for the stage: every screen no program output shows on, in the order the screens were listed. If there are no program outputs at all, the first screen is assumed to be the program screen and is left out, so the stage can never take over the program. */
export function stageScreenChoices(displays: Display[], outputs: { [id: string]: Output }): Display[] {
    const program = programOutputIds(outputs)
    if (program.length === 0) return displays.slice(1)
    return displays.filter((display) => !program.some((id) => displayInUse(display, outputs[id])))
}

/** The id of the output that already shows the church stage, if one exists (the first by id when several do), else null. */
export function churchStageOutputId(outputs: { [id: string]: Output }): string | null {
    const ids = Object.keys(outputs)
        .filter((id) => outputs[id].stageOutput === CHURCH_STAGE_ID)
        .sort()
    return ids.length > 0 ? ids[0] : null
}

/** The output settings that send the church stage to the chosen screen. Only these keys are set; everything else on the output stays as FreeShow gives it. */
export function stageOutputPatch(display: Display): Partial<Output> {
    return {
        stageOutput: CHURCH_STAGE_ID,
        name: "Stage",
        enabled: true,
        active: true,
        screen: String(display.id),
        bounds: { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height }
    }
}

/** Plain words for a screen in a list: its label if it has one, else its position, with its size. */
export function displayLabel(display: Display, index: number): string {
    const name = display.label || `Screen ${index + 1}`
    return `${name} (${display.bounds.width}×${display.bounds.height})`
}
