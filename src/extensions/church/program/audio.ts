import { get } from "svelte/store"
import { AudioPlayer } from "../../../frontend/audio/audioPlayer"
import { audioRouting } from "../../../frontend/stores"
import { testClockEnabled } from "../service/clock"

/** The choices for the audio out select: the system default first, then every real output device. */
export async function audioOutputChoices(): Promise<{ value: string; label: string }[]> {
    const devices = await AudioPlayer.getOutputs()
    return [{ value: "", label: "System default (embedded HDMI)" }, ...devices.map((device) => ({ value: device.value, label: device.label }))]
}

/** Which output device the program audio is routed to right now: "" for the system default, the device id for a specific one. */
export function currentAudioOutputDevice(): string {
    const routing = get(audioRouting)
    if (!routing) return ""
    const connection = routing.connections.find((c) => c.from === "main" && (c.to === "speaker_default" || c.to.startsWith("speaker_sub_")))
    if (!connection) return ""
    if (connection.to === "speaker_default") return ""
    return connection.to.replace("speaker_sub_", "")
}

/** Route the program audio to the chosen output device ("" for the system default), leaving every other channel alone. */
export function setAudioOutputDevice(deviceId: string): void {
    audioRouting.update((routing) => {
        if (!routing) return routing
        const connections = routing.connections.filter((c) => !(c.from === "main" && (c.to === "speaker_default" || c.to.startsWith("speaker_sub_"))))
        connections.push({ from: "main", to: deviceId ? "speaker_sub_" + deviceId : "speaker_default" })
        return { ...routing, connections }
    })
}

/** The audio out device, readable from the e2e tests. Only while the test clock is on. */
export function publishAudioHooks() {
    if (!testClockEnabled()) return
    ;(globalThis as { __ejsAudioDevice?: () => string }).__ejsAudioDevice = () => currentAudioOutputDevice()
}
