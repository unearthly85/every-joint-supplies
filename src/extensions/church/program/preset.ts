import type { Output } from "../../../types/Output"
import { churchStageOutputId, displayInUse, programOutputIds, type Display } from "../stage/screen"

/** The name FreeShow shows for this output, and the marker we use to find it again. */
export const CHURCH_PROGRAM_NAME = "Program"

/** The output settings that send the clean program to the chosen screen. Only these keys are set; everything else on the output stays as FreeShow gives it. */
export function programOutputPatch(display: Display): Partial<Output> {
    return {
        name: CHURCH_PROGRAM_NAME,
        enabled: true,
        active: true,
        color: "#000000",
        screen: String(display.id),
        bounds: { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height }
    }
}

/** The id of the output that is the church program output, if one exists (the first by id when several do), else null. */
export function churchProgramOutputId(outputs: { [id: string]: Output }): string | null {
    const ids = Object.keys(outputs)
        .filter((id) => {
            const output = outputs[id]
            return output.enabled && !output.stageOutput && !output.ndi && !output.omt && !output.webrtc && !output.rtmp && output.name === CHURCH_PROGRAM_NAME
        })
        .sort()
    return ids.length > 0 ? ids[0] : null
}

/** The screens a volunteer can pick for the program: every screen no program output and no stage output shows on, in the order the screens were listed. If there are no program outputs at all, the first screen is assumed to be the booth screen and is left out, so the program can never take over the booth. */
export function programScreenChoices(displays: Display[], outputs: { [id: string]: Output }): Display[] {
    const program = programOutputIds(outputs)
    const stageId = churchStageOutputId(outputs)
    return displays.filter((display, index) => {
        if (program.length === 0 && index === 0) return false
        if (program.some((id) => displayInUse(display, outputs[id]))) return false
        if (stageId !== null && displayInUse(display, outputs[stageId])) return false
        return true
    })
}
