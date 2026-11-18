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

export function onChurchAdvance(fn: (index: number) => void) {
    advanceTo = fn
}

export function resetChurchSession() {
    armed = null
    planKey = ""
    currentPlan = null
    booth.set(null)
}

/** A key or click moved the service. Drop the clock that belonged to the previous item. */
export function churchNoteManual() {
    if (!armed) return
    armed = { ...armed, generation: armed.generation + 1, dueAtMs: null, watchMedia: false }
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
        if (!armed || armed.index !== index) armed = armStep(plan, index, now, (armed?.generation ?? 0) + 1)
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
    const target = arm?.dueAtMs ?? (now.getTime() < start ? start : end)
    return {
        now: formatClock(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()),
        advertised: formatClock(parseClock(plan.advertisedTime)),
        remaining: formatRemaining(target - now.getTime()),
        line: countdownLine(plan)
    }
}
