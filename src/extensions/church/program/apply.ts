import { get } from "svelte/store"
import { addOutput, toggleOutputs } from "../../../frontend/components/helpers/output"
import { activeRename, outputs } from "../../../frontend/stores"
import { send } from "../../../frontend/utils/request"
import { OUTPUT } from "../../../types/Channels"
import { testClockEnabled } from "../service/clock"
import type { Display } from "../stage/screen"
import { CHURCH_PROGRAM_NAME, churchProgramOutputId, programOutputPatch } from "./preset"

/** Puts the clean program on the chosen screen. Reuses the program output when one exists, creates it when none does, and never touches the booth or the stage screen. Returns the program output id. */
export function useScreenForProgram(display: Display): string {
    const id = churchProgramOutputId(get(outputs))
    if (id) {
        outputs.update((all) => {
            Object.assign(all[id], programOutputPatch(display))
            return all
        })
        toggleOutputs([id], { state: true })
        send(OUTPUT, ["UPDATE_BOUNDS"], { id, ...get(outputs)[id] })
        activeRename.set(null)
        return id
    }
    const created = addOutput(false, "", true, CHURCH_PROGRAM_NAME)
    outputs.update((all) => {
        if (!all[created]) return all
        Object.assign(all[created], programOutputPatch(display))
        return all
    })
    send(OUTPUT, ["UPDATE_BOUNDS"], { id: created, ...get(outputs)[created] })
    activeRename.set(null)
    return created
}

/** The program output, readable from the e2e tests. Only while the test clock is on. */
export function publishProgramScreenHooks() {
    if (!testClockEnabled()) return
    const page = globalThis as { __ejsProgramOutput?: () => ({ id: string } & Record<string, unknown>) | null }
    page.__ejsProgramOutput = () => {
        const id = churchProgramOutputId(get(outputs))
        return id ? { id, ...get(outputs)[id] } : null
    }
}
