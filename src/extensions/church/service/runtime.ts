import { get } from "svelte/store"
import { getAllActiveOutputIds, setOutput } from "../../../frontend/components/helpers/output"
import { openProjectItem } from "../../../frontend/components/show/project"
import { activeProject, projects, showsCache } from "../../../frontend/stores"
import { isMainWindow } from "../../../frontend/utils/common"
import { churchTick, onChurchAdvance } from "./session"

let started = false

/** Ride alongside FreeShow's timer tick. A fake clock calls __ejsTick instead of waiting. */
export function watchChurchHandoff() {
    if (started) return
    started = true
    onChurchAdvance((index) => {
        const id = get(activeProject)
        if (!id) return
        openProjectItem(id, index)
        const item = get(projects)[id]?.shows?.[index]
        const outputId = getAllActiveOutputIds()[0]
        if (!item || !outputId || (item.type || "show") !== "show") return
        const show = get(showsCache)[item.id]
        const layout = show?.settings?.activeLayout
        if (layout) setOutput("slide", { id: item.id, layout, index: 0, projectIndex: index }, false, outputId)
    })
    const tick = () => {
        if (isMainWindow()) churchTick()
    }
    ;(globalThis as { __ejsTick?: () => void }).__ejsTick = tick
    const loop = () => {
        tick()
        setTimeout(loop, 400)
    }
    loop()
}
