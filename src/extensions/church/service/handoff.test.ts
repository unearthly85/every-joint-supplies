import { describe, expect, it } from "vitest"
import { faithCovenantSunday, toStored } from "./model"
import { systemTimeZone, timeZoneOffsetMs, zonedDateTime } from "./clock"
import { armStep, clockFires, countdownInstant, planFromProject, type Plan } from "./handoff"

const ZONE = "America/New_York"
const DATE = "2026-11-22"

function planFor(mode: "A" | "B", date = DATE, seconds = 5 * 60): Plan {
    const service = faithCovenantSunday(date, { timingMode: mode, countdownDurationSeconds: seconds })
    const stored = toStored(service)
    const plan = planFromProject({ ...stored.project, church: stored.project.church! }, ZONE)
    if (!plan) throw new Error("expected a plan")
    return plan
}

function at(plan: Plan, clock: string): Date {
    return zonedDateTime(plan.timeZone, plan.date, clock)
}

describe("section handoff", () => {
    it("mode A leaves the pre-service loop when the clock reaches the start time", () => {
        const plan = planFor("A")
        const welcome = plan.steps[0]
        const before = at(plan, "10:26:59")
        const start = at(plan, "10:27:00")
        const armed = armStep(plan, welcome.index, before, 1)
        expect(welcome.sectionKind).toBe("pre_service_loop")
        expect(welcome.autoAdvance).toBe(true)
        expect(clockFires(armed, before.getTime(), armed.generation)).toBe(false)
        expect(clockFires(armed, start.getTime(), armed.generation)).toBe(true)
        expect(armed.dueAtMs).toBe(countdownInstant(plan, "starts").getTime())
    })

    it("mode B starts the countdown so it ends at the start time", () => {
        const plan = planFor("B")
        const welcome = plan.steps[0]
        const countdown = plan.steps[1]
        const armed = armStep(plan, welcome.index, at(plan, "10:00:00"), 1)
        expect(armed.dueAtMs).toBe(at(plan, "10:22:00").getTime())
        expect(countdownInstant(plan, "ends").getTime()).toBe(at(plan, "10:27:00").getTime())
        const playing = armStep(plan, countdown.index, at(plan, "10:22:00"), 2)
        expect(playing.dueAtMs).toBe(at(plan, "10:27:00").getTime())
        expect(playing.watchMedia).toBe(true)
    })

    it("turns auto-advance on only when a timeframe is set", () => {
        const plan = planFor("A")
        const welcome = plan.steps[0]
        const scripture = plan.steps.find((step) => step.name === "Scripture")
        expect(welcome.autoAdvance).toBe(true)
        expect(scripture?.autoAdvance).toBe(false)
        expect(armStep(plan, scripture!.index, at(plan, "10:40:00"), 1).dueAtMs).toBeNull()
        const held = { ...welcome, autoAdvance: false }
        const custom = { ...plan, steps: plan.steps.map((step) => (step.index === held.index ? held : step)) }
        expect(armStep(custom, held.index, at(plan, "10:00:00"), 1).dueAtMs).toBeNull()
    })

    it("a manual advance cancels the handoff that was waiting on the clock", () => {
        const plan = planFor("A")
        const welcome = plan.steps[0]
        const countdown = plan.steps[1]
        const early = at(plan, "10:20:00")
        const waiting = armStep(plan, welcome.index, early, 1)
        expect(clockFires(waiting, at(plan, "10:27:00").getTime(), waiting.generation)).toBe(true)

        const moved = armStep(plan, countdown.index, early, waiting.generation + 1)
        expect(clockFires(waiting, at(plan, "10:27:00").getTime(), moved.generation)).toBe(false)
        expect(clockFires(moved, at(plan, "10:27:00").getTime(), moved.generation)).toBe(false)
        expect(clockFires(moved, at(plan, "10:32:00").getTime(), moved.generation)).toBe(true)
    })

    it("uses the real gap on a spring-forward Sunday and the repeated hour in the fall", () => {
        const springBefore = zonedDateTime(ZONE, "2026-03-08", "01:30:00")
        const springAfter = zonedDateTime(ZONE, "2026-03-08", "03:30:00")
        expect(springAfter.getTime() - springBefore.getTime()).toBe(60 * 60 * 1000)

        const fallEarly = zonedDateTime(ZONE, "2026-11-01", "00:30:00")
        const fallLate = zonedDateTime(ZONE, "2026-11-01", "03:00:00")
        expect(fallLate.getTime() - fallEarly.getTime()).toBe(3.5 * 60 * 60 * 1000)

        const springService = planFor("A", "2026-03-08")
        const fallService = planFor("A", "2026-11-01")
        expect(countdownInstant(springService, "ends").getTime() - countdownInstant(springService, "starts").getTime()).toBe(5 * 60 * 1000)
        expect(countdownInstant(fallService, "ends").getTime() - countdownInstant(fallService, "starts").getTime()).toBe(5 * 60 * 1000)
        expect(timeZoneOffsetMs(ZONE, springBefore)).not.toBe(timeZoneOffsetMs(ZONE, springAfter))
    })

    it("reads a Sunday back out of the stored project", () => {
        const stored = toStored(faithCovenantSunday(DATE))
        const plan = planFromProject(stored.project, systemTimeZone())
        expect(plan?.steps.map((step) => step.name)).toEqual(["Welcome slides", "Countdown video", "Announcements", "Scripture", "Song"])
        expect(planFromProject({ name: "x", created: 0, parent: "/", shows: [] }, ZONE)).toBeNull()
    })
})
