import { get } from "svelte/store"
import { enableStageOutput, toggleOutputs } from "../../../frontend/components/helpers/output"
import { activeRename, outputs } from "../../../frontend/stores"
import { send } from "../../../frontend/utils/request"
import { OUTPUT } from "../../../types/Channels"
import { testClockEnabled } from "../service/clock"
import { churchStageOutputId, programOutputIds, stageOutputPatch, type Display } from "./screen"

/** Puts the church stage on the chosen screen. Reuses the stage output when one exists, creates it when none does, and never touches a program output. Returns the stage output id. */
export function useScreenForStage(display: Display): string {
    const id = churchStageOutputId(get(outputs))
    if (id) {
        outputs.update((all) => {
            if (!all[id]) return all
            Object.assign(all[id], stageOutputPatch(display))
            return all
        })
        toggleOutputs([id], { state: true })
        send(OUTPUT, ["UPDATE_BOUNDS"], { id, ...get(outputs)[id] })
        return id
    }
    const created = enableStageOutput(stageOutputPatch(display))
    activeRename.set(null)
    return created
}

/** The stage output and the program outputs, readable from the e2e tests. Only while the test clock is on. */
export function publishStageScreenHooks() {
    if (!testClockEnabled()) return
    const page = globalThis as {
        __ejsStageOutput?: () => ({ id: string } & Record<string, unknown>) | null
        __ejsProgramOutputs?: () => { id: string; screen: string | null; bounds: { x: number; y: number; width: number; height: number } }[]
    }
    page.__ejsStageOutput = () => {
        const id = churchStageOutputId(get(outputs))
        return id ? { id, ...get(outputs)[id] } : null
    }
    page.__ejsProgramOutputs = () => programOutputIds(get(outputs)).map((id) => ({ id, screen: get(outputs)[id].screen, bounds: get(outputs)[id].bounds }))
}
