import { get } from "svelte/store"
import { getAllActiveOutputIds, setOutput } from "../../../frontend/components/helpers/output"
import { getMedia } from "../../../frontend/components/helpers/media"
import { AudioPlayer } from "../../../frontend/audio/audioPlayer"
import { openProjectItem } from "../../../frontend/components/show/project"
import { activeProject, outputs, playingVideos, projects, showsCache } from "../../../frontend/stores"
import { isMainWindow } from "../../../frontend/utils/common"
import { testClockEnabled } from "./clock"
import { churchTick, onChurchAdvance } from "./session"

let started = false
let timer: ReturnType<typeof setTimeout> | null = null

/** Put the Sunday item on the output the same way a click does. */
export async function showLiveItem(projectId: string, index: number) {
    openProjectItem(projectId, index)
    const item = get(projects)[projectId]?.shows?.[index]
    const outputId = getAllActiveOutputIds()[0]
    if (!item || !outputId) return
    const type = item.type || "show"
    if (type === "video" || type === "image" || type === "audio") {
        const mediaPath = item.data?.church?.mediaPath || item.id
        if (type === "audio") {
            AudioPlayer.start(mediaPath, { name: item.name || "" })
            return
        }
        const path = await locatedMediaPath(mediaPath)
        const onMediaEnd = item.data?.church?.timeframe?.onMediaEnd === true
        setOutput("slide", null, false, outputId)
        setOutput("background", { path, type, muted: true, loop: !onMediaEnd, startAt: 0, ignoreLayer: true, projectIndex: index }, false, outputId)
        return
    }
    if (type !== "show") return
    const show = get(showsCache)[item.id]
    const layout = show?.settings?.activeLayout
    if (!layout) return
    setOutput("background", null, false, outputId)
    setOutput("slide", { id: item.id, layout, index: 0, projectIndex: index }, false, outputId)
}

/** Ride alongside FreeShow's timer tick. The fake clock is only installed for test builds. */
export function watchChurchHandoff() {
    if (started) return
    started = true
    onChurchAdvance((index) => {
        const id = get(activeProject)
        if (id) void showLiveItem(id, index)
    })
    const tick = () => {
        if (isMainWindow()) churchTick()
        publishTestOutput()
    }
    if (testClockEnabled()) (globalThis as { __ejsTick?: () => void }).__ejsTick = tick
    publishTestOutput()
    const loop = () => {
        tick()
        timer = setTimeout(loop, 400)
    }
    loop()
}

export function stopChurchHandoff() {
    if (timer) clearTimeout(timer)
    timer = null
    started = false
}

async function locatedMediaPath(mediaPath: string): Promise<string> {
    try {
        const located = await getMedia(mediaPath)
        if (located?.path) return located.path
    } catch {
        // The stored path is already a full file path. Play that if locating it fails.
    }
    return mediaPath
}

/** The live output, readable only when the test clock is on. */
function publishTestOutput() {
    if (!testClockEnabled()) return
    const page = globalThis as { __ejsOutput?: () => TestOutput }
    page.__ejsOutput = testOutput
}

interface TestOutput {
    background: string
    slideId: string
    projectIndex: number | null
    playing: { path: string; paused: boolean; time: number }[]
}

function testOutput(): TestOutput {
    const list = Object.values(get(outputs)) as { enabled?: boolean; active?: boolean; out?: { slide?: { id?: string; projectIndex?: number } | null; background?: { path?: string; projectIndex?: number } | null } }[]
    const output = list.find((item) => item?.enabled !== false && item?.active !== false) || list[0]
    const slide = output?.out?.slide
    const background = output?.out?.background
    const projectIndex = typeof slide?.projectIndex === "number" ? slide.projectIndex : typeof background?.projectIndex === "number" ? background.projectIndex : null
    const playing = get(playingVideos).map((item) => ({
        path: item.path || "",
        paused: item.audio?.paused !== false,
        time: item.audio?.currentTime || 0
    }))
    return { background: background?.path || "", slideId: slide?.id || "", projectIndex, playing }
}
