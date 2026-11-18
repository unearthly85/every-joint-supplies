import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Fails when a FreeShow timer or action we extended is renamed or the call is dropped.
 */
describe("timer and action hooks", () => {
    const app = readFileSync(new URL("../../../frontend/App.svelte", import.meta.url), "utf8")
    const actions = readFileSync(new URL("../../../frontend/components/helpers/showActions.ts", import.meta.url), "utf8")
    const output = readFileSync(new URL("../../../frontend/components/helpers/OutputHelper.ts", import.meta.url), "utf8")
    const tick = readFileSync(new URL("../../../frontend/components/helpers/tick.ts", import.meta.url), "utf8")
    const timerTick = readFileSync(new URL("../../../frontend/components/helpers/timerTick.ts", import.meta.url), "utf8")

    it("still starts the Sunday handoff from the main window", () => {
        expect(app).toContain("watchChurchHandoff()")
        expect(timerTick).toContain("export function checkTimers()")
        expect(timerTick).toContain("export function startTimer()")
    })

    it("still advances on next-after-media, and a Sunday item can use that same path", () => {
        expect(actions).toContain("export async function checkNextAfterMedia(")
        expect(actions).toContain("churchOnMediaEnded()")
        expect(actions).toContain("nextAfterMedia")
    })

    it("still treats a manual advance as the winner over a pending next-slide timer", () => {
        expect(output).toContain("churchNoteManual()")
        expect(output).toContain("static advanceOutput(")
        expect(tick).toContain("export function newSlideTimer(")
        expect(tick).toContain("OutputHelper.advanceOutput(id, \"\", { playNext: true })")
    })
})
