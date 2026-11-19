import { get } from "svelte/store"
import { addOutput, toggleOutputs } from "../../../frontend/components/helpers/output"
import { activeRename, outputs, styles } from "../../../frontend/stores"
import { send } from "../../../frontend/utils/request"
import { OUTPUT } from "../../../types/Channels"
import type { Styles } from "../../../types/Settings"
import { testClockEnabled } from "../service/clock"
import type { Display } from "../stage/screen"
import { CHURCH_KEYABLE_NAME, CHURCH_KEYABLE_STYLE_ID, churchKeyableOutputId, keyableOutputPatch, keyableStyle } from "./preset"

/** Turns the keyable lower-thirds on the chosen screen. Makes sure the keyable style exists, reuses the keyable output when one exists, creates it when none does, and never touches the program output. Returns the keyable output id. */
export function enableKeyable(display: Display, color = "#00FF00"): string {
    styles.update((all) => (all[CHURCH_KEYABLE_STYLE_ID] ? all : { ...all, [CHURCH_KEYABLE_STYLE_ID]: keyableStyle(color) }))
    const id = churchKeyableOutputId(get(outputs))
    if (id) {
        outputs.update((all) => {
            if (!all[id]) return all
            Object.assign(all[id], keyableOutputPatch(display, CHURCH_KEYABLE_STYLE_ID))
            return all
        })
        toggleOutputs([id], { state: true })
        send(OUTPUT, ["UPDATE_BOUNDS"], { id, ...get(outputs)[id] })
        activeRename.set(null)
        return id
    }
    const created = addOutput(false, CHURCH_KEYABLE_STYLE_ID, true, CHURCH_KEYABLE_NAME)
    outputs.update((all) => {
        if (!all[created]) return all
        Object.assign(all[created], keyableOutputPatch(display, CHURCH_KEYABLE_STYLE_ID))
        return all
    })
    send(OUTPUT, ["UPDATE_BOUNDS"], { id: created, ...get(outputs)[created] })
    activeRename.set(null)
    return created
}

/** Turns the keyable lower-thirds off: removes the keyable output. A missing keyable output is a no-op, and the keyable style stays in place so turning it back on is quick. */
export function disableKeyable(): void {
    const id = churchKeyableOutputId(get(outputs))
    if (!id) return
    outputs.update((all) => {
        const rest = { ...all }
        delete rest[id]
        return rest
    })
    send(OUTPUT, ["REMOVE"], { id })
}

/** The keyable output and the keyable style, readable from the e2e tests. Only while the test clock is on. */
export function publishKeyableHooks() {
    if (!testClockEnabled()) return
    const page = globalThis as {
        __ejsKeyableOutput?: () => ({ id: string } & Record<string, unknown>) | null
        __ejsKeyableStyle?: () => Styles | null
    }
    page.__ejsKeyableOutput = () => {
        const id = churchKeyableOutputId(get(outputs))
        return id ? { id, ...get(outputs)[id] } : null
    }
    page.__ejsKeyableStyle = () => get(styles)[CHURCH_KEYABLE_STYLE_ID] || null
}
