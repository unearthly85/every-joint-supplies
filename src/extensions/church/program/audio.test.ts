import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioPlayer } from "../../../frontend/audio/audioPlayer"
import { audioRouting } from "../../../frontend/stores"
import type { AudioRoutingConfig, AudioRoutingConnection } from "../../../types/AudioRouting"
import { audioOutputChoices, currentAudioOutputDevice, publishAudioHooks, setAudioOutputDevice } from "./audio"

vi.mock("../../../frontend/audio/audioPlayer", () => ({
    AudioPlayer: { getOutputs: vi.fn() }
}))

const getOutputs = vi.spyOn(AudioPlayer, "getOutputs")

function routing(connections: AudioRoutingConnection[]): AudioRoutingConfig {
    return {
        channels: [
            { id: "main", name: "Main" },
            { id: "channel_metronome", name: "Metronome" }
        ],
        connections
    }
}

function programSpeakerConnections(config: AudioRoutingConfig | null): AudioRoutingConnection[] {
    return (config?.connections || []).filter((c) => c.from === "main" && (c.to === "speaker_default" || c.to.startsWith("speaker_sub_")))
}

beforeEach(() => {
    getOutputs.mockReset()
    audioRouting.set(null)
})

afterEach(() => {
    delete (globalThis as { __ejsTestClock?: boolean }).__ejsTestClock
    delete (globalThis as { __ejsAudioDevice?: () => string }).__ejsAudioDevice
    audioRouting.set(null)
})

describe("choosing the audio out device", () => {
    it("routes the program to the system default and removes a specific device", () => {
        audioRouting.set(
            routing([
                { from: "drawer_audio", to: "main" },
                { from: "main", to: "speaker_sub_dev123" },
                { from: "channel_metronome", to: "speaker_default" }
            ])
        )
        setAudioOutputDevice("")
        const connections = get(audioRouting)!.connections
        expect(programSpeakerConnections(get(audioRouting))).toEqual([{ from: "main", to: "speaker_default" }])
        expect(connections).toContainEqual({ from: "drawer_audio", to: "main" })
        expect(connections).toContainEqual({ from: "channel_metronome", to: "speaker_default" })
    })

    it("routes the program to the chosen device and removes the system default", () => {
        audioRouting.set(
            routing([
                { from: "drawer_audio", to: "main" },
                { from: "main", to: "speaker_default" },
                { from: "channel_metronome", to: "speaker_default" }
            ])
        )
        setAudioOutputDevice("dev123")
        const connections = get(audioRouting)!.connections
        expect(programSpeakerConnections(get(audioRouting))).toEqual([{ from: "main", to: "speaker_sub_dev123" }])
        expect(connections).toContainEqual({ from: "drawer_audio", to: "main" })
        expect(connections).toContainEqual({ from: "channel_metronome", to: "speaker_default" })
    })

    it("switching from one device to another leaves a single program connection", () => {
        audioRouting.set(routing([{ from: "main", to: "speaker_sub_dev123" }]))
        setAudioOutputDevice("dev456")
        expect(programSpeakerConnections(get(audioRouting))).toEqual([{ from: "main", to: "speaker_sub_dev456" }])
    })

    it("leaves the other channels alone", () => {
        audioRouting.set(
            routing([
                { from: "metronome", to: "channel_metronome" },
                { from: "channel_metronome", to: "speaker_default" },
                { from: "main", to: "speaker_default" }
            ])
        )
        setAudioOutputDevice("dev123")
        const connections = get(audioRouting)!.connections
        expect(connections).toContainEqual({ from: "metronome", to: "channel_metronome" })
        expect(connections).toContainEqual({ from: "channel_metronome", to: "speaker_default" })
    })

    it("does nothing when the routing is not loaded", () => {
        audioRouting.set(null)
        setAudioOutputDevice("dev123")
        expect(get(audioRouting)).toBeNull()
    })
})

describe("reading the audio out device", () => {
    it("is the system default when the program goes to the default speaker", () => {
        audioRouting.set(routing([{ from: "main", to: "speaker_default" }]))
        expect(currentAudioOutputDevice()).toBe("")
    })

    it("is the device id when the program goes to a specific device", () => {
        audioRouting.set(routing([{ from: "main", to: "speaker_sub_dev123" }]))
        expect(currentAudioOutputDevice()).toBe("dev123")
    })

    it("is the system default when the program has no speaker connection", () => {
        audioRouting.set(routing([{ from: "channel_metronome", to: "speaker_default" }]))
        expect(currentAudioOutputDevice()).toBe("")
    })

    it("is the system default when the routing is not loaded", () => {
        audioRouting.set(null)
        expect(currentAudioOutputDevice()).toBe("")
    })
})

describe("the audio out choices", () => {
    it("puts the system default first, then every real device", async () => {
        getOutputs.mockResolvedValue([
            { value: "dev123", label: "Speaker One", channels: 2 },
            { value: "dev456", label: "PA System", channels: 8 }
        ])
        expect(await audioOutputChoices()).toEqual([
            { value: "", label: "System default (embedded HDMI)" },
            { value: "dev123", label: "Speaker One" },
            { value: "dev456", label: "PA System" }
        ])
        expect(getOutputs).toHaveBeenCalledTimes(1)
    })

    it("offers only the system default when there are no real devices", async () => {
        getOutputs.mockResolvedValue([])
        expect(await audioOutputChoices()).toEqual([{ value: "", label: "System default (embedded HDMI)" }])
    })
})

describe("test hooks", () => {
    it("exposes the audio out device while the test clock is on", () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = true
        audioRouting.set(routing([{ from: "main", to: "speaker_sub_dev123" }]))
        publishAudioHooks()
        const page = globalThis as { __ejsAudioDevice?: () => string }
        expect(page.__ejsAudioDevice?.()).toBe("dev123")
    })

    it("does not expose the hook while the test clock is off", () => {
        ;(globalThis as { __ejsTestClock?: boolean }).__ejsTestClock = false
        publishAudioHooks()
        expect((globalThis as { __ejsAudioDevice?: unknown }).__ejsAudioDevice).toBeUndefined()
    })
})
