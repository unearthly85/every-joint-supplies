import { get } from "svelte/store"
import { activeProject, outputs, projects } from "../../../frontend/stores"
import { countdownLine, formatClock, parseClock } from "./model"
import { booth } from "./booth"
import { churchNow, systemTimeZone } from "./clock"
import { armStep, clockFires, countdownInstant, formatRemaining, mediaMatches, nextItemIndex, planFromProject, type Arm, type Plan } from "./handoff"

/**
 * Watches the live Sunday and asks FreeShow to move when a handoff is due.
 * The move itself is FreeShow's next-slide / next-on-media-finished path.
 */

let armed: Arm | null = null
let planKey = ""
let currentPlan: Plan | null = null
let advanceTo: ((index: number) => void) | null = null

export const AUTO_ADVANCE_OFF = "Auto-advance off for this item"

export function onChurchAdvance(fn: (index: number) => void) {
    advanceTo = fn
}

export function resetChurchSession() {
    armed = null
    planKey = ""
    currentPlan = null
    booth.set(null)
}

/**
 * A gesture put something else on the output. Clicks that stay on the armed
 * item, and clicks that never reach the output, are not a manual move.
 */
export function churchNoteManual(next?: { projectIndex?: number | null; showId?: string | null } | null) {
    if (!armed || staysOnArmedItem(next)) return
    armed = { ...armed, generation: armed.generation + 1, dueAtMs: null, watchMedia: false, cancelled: true }
}

function staysOnArmedItem(next?: { projectIndex?: number | null; showId?: string | null } | null): boolean {
    if (!armed || !next) return false
    if (typeof next.projectIndex === "number" && next.projectIndex >= 0 && next.projectIndex === armed.index) return true
    if (!next.showId) return false
    const step = currentPlan?.steps.find((item) => item.index === armed?.index)
    return step?.showId === next.showId
}

export function churchOnMediaEnded(endedId = ""): boolean {
    if (!armed?.watchMedia || !currentPlan || !endedId) return false
    const step = currentPlan.steps.find((item) => item.index === armed?.index)
    if (!mediaMatches(step?.mediaPath || null, endedId)) return false
    const next = nextItemIndex(currentPlan, armed.index)
    armed = { ...armed, generation: armed.generation + 1, dueAtMs: null, watchMedia: false }
    advanceTo?.(next)
    return true
}

export function churchTick() {
    const id = get(activeProject)
    const project = id ? get(projects)[id] : null
    const plan = project ? planFromProject(project, systemTimeZone()) : null
    currentPlan = plan
    if (!id || !plan) {
        armed = null
        planKey = ""
        currentPlan = null
        booth.set(null)
        return
    }
    if (planKey !== id) {
        planKey = id
        armed = null
    }

    const now = churchNow()
    const index = liveProjectIndex()
    if (typeof index === "number") {
        const step = plan.steps.find((item) => item.index === index)
        const toggleChanged = !!armed && armed.index === index && armed.autoAdvance !== !!step?.autoAdvance
        if (!armed || armed.index !== index || toggleChanged) armed = armStep(plan, index, now, (armed?.generation ?? 0) + 1)
        if (armed && armed.index === index && clockFires(armed, now.getTime(), armed.generation)) {
            const next = nextItemIndex(plan, index)
            armed = { ...armed, dueAtMs: null, watchMedia: false, generation: armed.generation + 1 }
            advanceTo?.(next)
        }
    }

    booth.set(boothView(plan, armed, now))
}

function liveProjectIndex(): number | null {
    for (const output of Object.values(get(outputs)) as { enabled?: boolean; active?: boolean; out?: { slide?: { projectIndex?: number } | null; background?: { projectIndex?: number } | null } }[]) {
        if (output?.enabled === false || output?.active === false) continue
        const slideIndex = output?.out?.slide?.projectIndex
        if (typeof slideIndex === "number") return slideIndex
        const backgroundIndex = output?.out?.background?.projectIndex
        if (typeof backgroundIndex === "number") return backgroundIndex
    }
    return null
}

function boothView(plan: Plan, arm: Arm | null, now: Date) {
    const start = countdownInstant(plan, "starts").getTime()
    const end = countdownInstant(plan, "ends").getTime()
    const step = arm ? plan.steps.find((item) => item.index === arm.index) : null
    const target = arm?.dueAtMs ?? (now.getTime() < start ? start : end)
    return {
        now: formatClock(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()),
        advertised: formatClock(parseClock(plan.advertisedTime)),
        remaining: remainingText(step, arm, target - now.getTime()),
        line: countdownLine(plan)
    }
}

function stepHadTimeframe(step: { durationSeconds: number | null; untilTime: string | null; onMediaEnd: boolean } | null | undefined): boolean {
    if (!step) return false
    return step.durationSeconds != null || !!step.untilTime || step.onMediaEnd
}

function remainingText(step: { durationSeconds: number | null; untilTime: string | null; onMediaEnd: boolean; autoAdvance: boolean } | null | undefined, arm: Arm | null, fallbackMs: number): string {
    const hadTimeframe = stepHadTimeframe(step)
    const passed = !!arm && hadTimeframe && arm.autoAdvance && arm.dueAtMs == null
    const turnedOff = !!arm && hadTimeframe && step?.autoAdvance === false
    if (hadTimeframe && (passed || turnedOff || arm?.cancelled)) return AUTO_ADVANCE_OFF
    return formatRemaining(fallbackMs)
}
