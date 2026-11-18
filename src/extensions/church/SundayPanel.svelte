<script lang="ts" context="module">
    import { writable } from "svelte/store"

    export const sundayPanelOpen = writable(false)
</script>

<script lang="ts">
    import { get } from "svelte/store"
    import { checkName } from "../../frontend/components/helpers/show"
    import { activeProject, projects, shows, showsCache, statusIndicator } from "../../frontend/stores"
    import { save } from "../../frontend/utils/save"
    import { canonicalClock, countdownLine, FAITH_COVENANT_SUNDAY, faithCovenantSunday, formatClock, nextSunday, parseClock, resolveCountdownSeconds, toStored, type TimingMode } from "./service/model"

    let serviceDate = nextSunday()
    let advertisedTime = FAITH_COVENANT_SUNDAY.advertisedTime
    let startTime = FAITH_COVENANT_SUNDAY.startTime
    let advertisedField = formatClock(parseClock(advertisedTime))
    let startField = formatClock(parseClock(startTime))
    let countdownMinutes = 5
    let countdownSeconds = 0
    let countdownMediaPath = "media/countdown.mp4"
    let countdownVideoLabel = ""
    let finishesAtStart = false
    let problem = ""

    $: timingMode = (finishesAtStart ? "B" : "A") as TimingMode
    $: durationSeconds = Math.max(0, Math.round(Number(countdownMinutes) || 0) * 60 + (Number(countdownSeconds) || 0))
    $: line = describeCountdown(timingMode, startTime, durationSeconds)

    function describeCountdown(mode: TimingMode, start: string, seconds: number): string {
        try {
            return countdownLine({ timingMode: mode, startTime: start, countdownDurationSeconds: seconds })
        } catch {
            return "Enter a start time like 10:27 AM"
        }
    }

    function commitTime(which: "advertised" | "start", value: string) {
        try {
            const canonical = canonicalClock(parseClock(value))
            if (which === "advertised") {
                advertisedTime = canonical
                advertisedField = formatClock(parseClock(canonical))
            } else {
                startTime = canonical
                startField = formatClock(parseClock(canonical))
            }
            problem = ""
        } catch {
            problem = "Enter a time like 10:30 AM"
        }
    }

    function waitUntilSaveFinishes(): Promise<void> {
        if (get(statusIndicator) !== "saving") return Promise.resolve()
        return new Promise((resolve) => {
            let unsubscribe = () => {}
            unsubscribe = statusIndicator.subscribe((value) => {
                if (value === "saving") return
                unsubscribe()
                resolve()
            })
        })
    }

    function pickCountdownVideo(event: Event) {
        const file = (event.currentTarget as HTMLInputElement).files?.[0] as (File & { path?: string }) | undefined
        if (!file) return
        countdownMediaPath = file.path || file.name
        countdownVideoLabel = file.name
        const url = URL.createObjectURL(file)
        const video = document.createElement("video")
        video.preload = "metadata"
        video.src = url
        video.onloadedmetadata = () => {
            const seconds = resolveCountdownSeconds(durationSeconds, video.duration)
            countdownMinutes = Math.floor(seconds / 60)
            countdownSeconds = seconds % 60
            URL.revokeObjectURL(url)
        }
    }

    async function startSunday() {
        problem = ""
        if (!serviceDate) {
            problem = "Choose a service date"
            return
        }
        let stored: ReturnType<typeof toStored>
        try {
            stored = toStored(faithCovenantSunday(serviceDate, { advertisedTime, startTime, timingMode, countdownDurationSeconds: durationSeconds, countdownMediaPath }))
        } catch {
            problem = "Enter times like 10:30 AM and 10:27 AM"
            return
        }

        const existing = get(projects)[stored.projectId]
        if (existing && !existing.deleted) {
            activeProject.set(stored.projectId)
            sundayPanelOpen.set(false)
            return
        }

        for (const [id, show] of Object.entries(stored.shows)) {
            show.name = checkName(show.name)
            shows.update((list) => ({
                ...list,
                [id]: { name: show.name, origin: show.origin, category: show.category, timestamps: show.timestamps }
            }))
        }
        showsCache.update((cache) => ({ ...cache, ...stored.shows }))
        projects.update((all) => ({ ...all, [stored.projectId]: stored.project }))
        activeProject.set(stored.projectId)
        try {
            // A save already in progress captured the previous snapshot. Wait, then save this Sunday too.
            await waitUntilSaveFinishes()
            save()
        } catch (error) {
            console.error(error)
            problem = "This Sunday could not be saved. Try again."
            return
        }
        sundayPanelOpen.set(false)
    }
</script>

{#if $sundayPanelOpen}
    <div class="shade">
        <section data-testid="new-sunday" aria-label="New Sunday">
            <header>
                <h1>New Sunday</h1>
                <button type="button" data-testid="close-sunday" on:click={() => sundayPanelOpen.set(false)}>Close</button>
            </header>
            <p>Faith Covenant Sunday: pre-service, a countdown, announcements, scripture, and a song.</p>

            <label>
                Service date
                <input data-testid="service-date" type="date" bind:value={serviceDate} />
            </label>
            <label>
                Advertised time
                <input data-testid="advertised-time" type="text" bind:value={advertisedField} on:change={(event) => commitTime("advertised", event.currentTarget.value)} />
            </label>
            <label>
                Start time
                <input data-testid="start-time" type="text" bind:value={startField} on:change={(event) => commitTime("start", event.currentTarget.value)} />
            </label>
            <label>
                Countdown video
                <input data-testid="countdown-video" type="file" accept="video/*" on:change={pickCountdownVideo} />
                {#if countdownVideoLabel}<span>{countdownVideoLabel}</span>{/if}
            </label>
            <div class="length">
                <span>Countdown length</span>
                <label>
                    <input data-testid="countdown-minutes" type="number" min="0" bind:value={countdownMinutes} />
                    minutes
                </label>
                <label>
                    <input data-testid="countdown-seconds" type="number" min="0" bind:value={countdownSeconds} />
                    seconds
                </label>
            </div>
            <label class="check">
                <input data-testid="countdown-finishes-at-start" type="checkbox" bind:checked={finishesAtStart} />
                Countdown finishes at the start time
            </label>

            <p data-testid="countdown-line">{line}</p>
            {#if problem}<p class="problem" data-testid="sunday-problem">{problem}</p>{/if}

            <button data-testid="start-sunday" type="button" on:click={startSunday}>Start this Sunday</button>
        </section>
    </div>
{/if}

<style>
    .shade {
        position: fixed;
        inset: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(0 0 0 / 0.55);
    }

    section {
        width: 440px;
        max-width: calc(100% - 32px);
        padding: 16px;
        background: var(--primary);
        color: var(--text);
        border: 2px solid var(--primary-lighter);
        border-radius: 10px;
        box-shadow: 0 0 5px 5px rgb(0 0 0 / 0.2);
        font-size: 18px;
        line-height: 1.4;
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    h1 {
        margin: 0;
        color: var(--text);
        font-size: 26px;
    }

    p {
        margin: 12px 0;
    }

    label,
    .length {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
        font-weight: 600;
    }

    .length {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
    }

    .length label {
        flex-direction: row;
        align-items: center;
        margin: 0;
        font-weight: 500;
    }

    label.check {
        flex-direction: row;
        align-items: center;
        font-weight: 500;
    }

    input[type="date"],
    input[type="text"],
    input[type="number"] {
        font-size: 20px;
        padding: 8px;
        color: var(--text);
        background: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    input[type="number"] {
        width: 5rem;
    }

    button {
        padding: 8px 12px;
        font-size: 18px;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        cursor: pointer;
    }

    button[data-testid="start-sunday"] {
        width: 100%;
        margin-top: 4px;
        padding: 12px;
        font-size: 20px;
        font-weight: 700;
        background: var(--secondary);
    }

    .problem {
        color: var(--red, #ff8d8d);
        font-weight: 700;
    }
</style>
