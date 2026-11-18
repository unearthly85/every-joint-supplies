/**
 * Wall-clock instants in a real timezone, including DST.
 * Tests and the booth can replace "now" without waiting for the clock.
 */

let override: (() => Date) | null = null

export function testClockEnabled(): boolean {
    return (globalThis as { __ejsTestClock?: boolean }).__ejsTestClock === true
}

export function churchNow(): Date {
    if (override) return override()
    if (testClockEnabled()) {
        const injected = (globalThis as { __ejsNow?: () => Date }).__ejsNow
        if (typeof injected === "function") return injected()
    }
    return new Date()
}

export function setChurchClock(fn: (() => Date) | null) {
    override = fn
}

export function systemTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

/** UTC offset of `timeZone` at `instant`, in milliseconds (local = UTC + offset). */
export function timeZoneOffsetMs(timeZone: string, instant: Date): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }).formatToParts(instant)
    const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour") % 24, pick("minute"), pick("second"))
    return asUtc - instant.getTime()
}

/**
 * The instant when the wall clock in `timeZone` reads `date` + `clock`.
 * Spring-forward gaps land on the later offset. Fall-back repeats land on the first one.
 */
export function zonedDateTime(timeZone: string, date: string, clock: string): Date {
    const [year, month, day] = date.split("-").map(Number)
    const [hour, minute, second] = clock.split(":").map(Number)
    const utcGuess = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0)
    const first = timeZoneOffsetMs(timeZone, new Date(utcGuess))
    const instant = new Date(utcGuess - first)
    const secondOffset = timeZoneOffsetMs(timeZone, instant)
    if (secondOffset === first) return instant
    return new Date(utcGuess - secondOffset)
}
