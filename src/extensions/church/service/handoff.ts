import type { Project } from "../../../types/Projects"
import { countdownWindow, type SectionKind, type TimingMode } from "./model"
import { zonedDateTime } from "./clock"

/**
 * When the current item should hand off. This does not run a timer.
 * FreeShow's next-slide timer and "next on media finished" perform the move.
 */

export interface Step {
    index: number
    name: string
    sectionKind: SectionKind | null
    autoAdvance: boolean
    untilTime: string | null
    durationSeconds: number | null
    onMediaEnd: boolean
}

export interface Plan {
    date: string
    timeZone: string
    timingMode: TimingMode
    startTime: string
    countdownDurationSeconds: number
    advertisedTime: string
    steps: Step[]
}

export interface Arm {
    index: number
    enteredAtMs: number
    generation: number
    dueAtMs: number | null
    watchMedia: boolean
}

export function countdownInstant(plan: Pick<Plan, "timeZone" | "date" | "timingMode" | "startTime" | "countdownDurationSeconds">, edge: "starts" | "ends"): Date {
    const window = countdownWindow(plan.timingMode, plan.startTime, plan.countdownDurationSeconds)
    return zonedDateTime(plan.timeZone, plan.date, window[edge])
}

export function nextItemIndex(plan: Plan, index: number): number {
    const next = plan.steps.find((step) => step.index > index)
    return next ? next.index : index + 1
}

export function armStep(plan: Plan, index: number, enteredAt: Date, generation: number): Arm {
    const step = plan.steps.find((item) => item.index === index)
    const due = step ? dueAtMs(plan, step, enteredAt) : null
    return {
        index,
        enteredAtMs: enteredAt.getTime(),
        generation,
        dueAtMs: due,
        watchMedia: !!step && step.autoAdvance && step.onMediaEnd
    }
}

/** The clock for this step has arrived. A newer generation means a manual advance already cancelled it. */
export function clockFires(arm: Arm, nowMs: number, generation: number): boolean {
    if (arm.generation !== generation) return false
    if (arm.dueAtMs == null) return false
    return nowMs >= arm.dueAtMs
}

export function planFromProject(project: Project & { church?: { date: string; advertisedTime: string; startTime: string; timingMode: TimingMode; countdownDurationSeconds: number } }, timeZone: string): Plan | null {
    const church = project.church
    if (!church || church.timingMode !== "A" && church.timingMode !== "B") return null
    let sectionKind: SectionKind | null = null
    const steps: Step[] = []
    project.shows?.forEach((ref, index) => {
        if (ref.type === "section") {
            sectionKind = ref.data?.church?.kind || null
            return
        }
        const item = ref.data?.church
        if (!item) return
        const timeframe = item.timeframe
        const autoAdvance = typeof item.autoAdvance === "boolean" ? item.autoAdvance : !!(timeframe && (timeframe.durationSeconds != null || timeframe.untilTime || timeframe.onMediaEnd))
        steps.push({
            index,
            name: ref.name || item.itemType || "Item",
            sectionKind,
            autoAdvance,
            untilTime: timeframe?.untilTime || null,
            durationSeconds: timeframe?.durationSeconds ?? null,
            onMediaEnd: timeframe?.onMediaEnd === true
        })
    })
    return {
        date: church.date,
        timeZone,
        timingMode: church.timingMode,
        startTime: church.startTime,
        countdownDurationSeconds: church.countdownDurationSeconds,
        advertisedTime: church.advertisedTime,
        steps
    }
}

export function formatRemaining(ms: number): string {
    if (ms <= 0) return "0:00"
    const total = Math.ceil(ms / 1000)
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function dueAtMs(plan: Plan, step: Step, enteredAt: Date): number | null {
    if (!step.autoAdvance) return null
    const times: number[] = []
    if (step.sectionKind === "pre_service_loop") times.push(countdownInstant(plan, "starts").getTime())
    else if (step.untilTime) times.push(zonedDateTime(plan.timeZone, plan.date, step.untilTime).getTime())
    if (step.sectionKind === "warmup") times.push(countdownInstant(plan, "ends").getTime())
    else if (step.durationSeconds != null) times.push(enteredAt.getTime() + step.durationSeconds * 1000)
    if (!times.length) return null
    return Math.min(...times)
}
