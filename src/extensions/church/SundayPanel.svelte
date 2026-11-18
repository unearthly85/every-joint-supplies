<script lang="ts">
    import { activeProject, projects, shows, showsCache } from "../../frontend/stores"
    import { save } from "../../frontend/utils/save"
    import { countdownLine, FAITH_COVENANT_SUNDAY, faithCovenantSunday, toStored, type TimingMode } from "./service/model"

    let serviceDate = today()
    let advertisedTime = FAITH_COVENANT_SUNDAY.advertisedTime
    let startTime = FAITH_COVENANT_SUNDAY.startTime
    let finishesAtStart = false
    let ready = ""
    let problem = ""

    $: timingMode = (finishesAtStart ? "B" : "A") as TimingMode
    $: line = describeCountdown(timingMode, startTime)

    function today(): string {
        const now = new Date()
        const month = String(now.getMonth() + 1).padStart(2, "0")
        const day = String(now.getDate()).padStart(2, "0")
        return `${now.getFullYear()}-${month}-${day}`
    }

    function describeCountdown(mode: TimingMode, start: string): string {
        try {
            return countdownLine({ timingMode: mode, startTime: start, countdownDurationMs: FAITH_COVENANT_SUNDAY.countdownDurationMs })
        } catch {
            return "Enter a start time like 10:27"
        }
    }

    function startSunday() {
        problem = ""
        ready = ""
        if (!serviceDate) {
            problem = "Choose a service date"
            return
        }
        let stored: ReturnType<typeof toStored>
        try {
            stored = toStored(faithCovenantSunday(serviceDate, { advertisedTime, startTime, timingMode }))
        } catch {
            problem = "Enter times like 10:30 and 10:27"
            return
        }

        showsCache.update((cache) => ({ ...cache, ...stored.shows }))
        shows.update((list) => {
            const next = { ...list }
            for (const [id, show] of Object.entries(stored.shows)) {
                next[id] = { name: show.name, origin: show.origin, category: show.category, timestamps: show.timestamps }
            }
            return next
        })
        projects.update((all) => ({ ...all, [stored.projectId]: stored.project }))
        activeProject.set(stored.projectId)
        try {
            save()
        } catch {
            // The Sunday is already in the list. The next save writes it.
        }
        ready = `This Sunday is ready. Advertised time ${advertisedTime}.`
    }
</script>

<section data-testid="new-sunday" aria-label="New Sunday">
    <h1>New Sunday</h1>
    <p>Faith Covenant Sunday: pre-service, a countdown, announcements, scripture, and a song.</p>

    <label>
        Service date
        <input type="date" bind:value={serviceDate} />
    </label>
    <label>
        Advertised time
        <input data-testid="advertised-time" type="time" bind:value={advertisedTime} />
    </label>
    <label>
        Start time
        <input data-testid="start-time" type="time" bind:value={startTime} />
    </label>
    <label class="check">
        <input data-testid="countdown-finishes-at-start" type="checkbox" bind:checked={finishesAtStart} />
        Countdown finishes at the start time
    </label>

    <p data-testid="countdown-line">{line}</p>
    {#if problem}<p class="problem" data-testid="sunday-problem">{problem}</p>{/if}
    {#if ready}<p class="ready" data-testid="sunday-ready">{ready}</p>{/if}

    <button data-testid="start-sunday" type="button" on:click={startSunday}>Start this Sunday</button>
</section>

<style>
    section {
        position: fixed;
        top: 56px;
        right: 16px;
        z-index: 40;
        width: 340px;
        padding: 16px;
        background: #ffffff;
        color: #1c1c1c;
        border: 1px solid #c8c8c8;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        font-size: 18px;
        line-height: 1.4;
    }

    h1 {
        margin: 0 0 8px;
        font-size: 26px;
    }

    p {
        margin: 0 0 12px;
    }

    label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
        font-weight: 600;
    }

    label.check {
        flex-direction: row;
        align-items: center;
        font-weight: 500;
    }

    input[type="date"],
    input[type="time"] {
        font-size: 20px;
        padding: 8px;
        color: #1c1c1c;
        background: #ffffff;
        border: 1px solid #8d8d8d;
        border-radius: 8px;
    }

    button {
        width: 100%;
        margin-top: 4px;
        padding: 12px;
        font-size: 20px;
        font-weight: 700;
        color: #ffffff;
        background: #1f4e8c;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
    }

    .problem {
        color: #8d1d1d;
    }

    .ready {
        color: #1d5c32;
        font-weight: 700;
    }
</style>
