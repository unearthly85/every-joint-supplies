<script lang="ts">
    import { onMount } from "svelte"
    import { get } from "svelte/store"
    import { requestMain } from "../../frontend/IPC/main"
    import { outputs, stageShows } from "../../frontend/stores"
    import { Main } from "../../types/IPC/Main"
    import { publishStageScreenHooks, updateStageToggles, useScreenForStage } from "./stage/apply"
    import { CHURCH_STAGE_ID, readStageToggles, type StageToggles } from "./stage/layout"
    import { displayLabel, listDisplays, stageScreenChoices, type Display } from "./stage/screen"

    let displays: Display[] = []
    let loaded = false
    let on = false
    let chosenId = ""

    // Read the saved switches once, when the panel mounts. Closing and reopening the panel remounts this component, so the saved values come back here.
    const churchLayout = get(stageShows)[CHURCH_STAGE_ID]
    let toggles: Required<StageToggles> | null = churchLayout ? readStageToggles(churchLayout) : null

    function setToggle(change: Partial<Required<StageToggles>>) {
        if (!toggles) return
        toggles = { ...toggles, ...change }
        updateStageToggles(change)
    }

    $: choices = stageScreenChoices(displays, $outputs)
    $: if (!chosenId && choices.length > 0) chosenId = String(choices[0].id)
    $: chosen = choices.find((item) => String(item.id) === chosenId) || choices[0] || null

    onMount(async () => {
        publishStageScreenHooks()
        displays = await listDisplays(() => requestMain(Main.GET_DISPLAYS))
        loaded = true
    })

    function useChosen() {
        if (!chosen) return
        useScreenForStage(chosen)
        on = true
    }
</script>

<fieldset class="stage-screen" data-testid="stage-screen">
    <legend>Stage screen</legend>
    {#if on}
        <p class="stage-screen-on" data-testid="stage-screen-on">The stage screen is on.</p>
    {:else if loaded && choices.length === 0}
        <p class="stage-screen-none" data-testid="stage-no-screen">Connect a second screen to use it for the stage.</p>
    {:else}
        <label class="stage-screen-label">
            Screen
            <select data-testid="stage-screen-choice" bind:value={chosenId}>
                {#each choices as choice, index}
                    <option value={String(choice.id)}>{displayLabel(choice, index)}</option>
                {/each}
            </select>
        </label>
        <button type="button" data-testid="use-stage-screen" on:click={useChosen}>Use this screen for the stage</button>
    {/if}
</fieldset>

{#if toggles}
    <fieldset class="stage-toggles" data-testid="stage-toggles">
        <legend>On the stage screen</legend>
        <label class="stage-toggle">
            <input type="checkbox" data-testid="stage-show-notes" checked={toggles.notes} on:change={(e) => setToggle({ notes: e.currentTarget.checked })} />
            Show notes
        </label>
        <label class="stage-toggle">
            <input type="checkbox" data-testid="stage-show-chords" checked={toggles.chords} on:change={(e) => setToggle({ chords: e.currentTarget.checked })} />
            Show chords
        </label>
        <label class="stage-toggle">
            <input type="checkbox" data-testid="stage-show-message" checked={toggles.message} on:change={(e) => setToggle({ message: e.currentTarget.checked })} />
            Show a message to the stage
        </label>
        {#if toggles.message}
            <input type="text" data-testid="stage-message-text" class="stage-message-text" placeholder="Message for the singers or preacher" value={toggles.messageText} on:change={(e) => setToggle({ messageText: e.currentTarget.value })} />
        {/if}
    </fieldset>
{/if}

<style>
    .stage-screen {
        margin: 0 0 12px;
        padding: 10px 12px;
        color: var(--text);
        background: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .stage-screen legend {
        padding: 0 6px;
        font-weight: 700;
        color: var(--text);
    }

    .stage-screen p {
        margin: 0;
    }

    .stage-screen-label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
        font-weight: 600;
    }

    .stage-screen-label select {
        font-size: 18px;
        padding: 8px;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .stage-screen button {
        padding: 8px 12px;
        font-size: 18px;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        cursor: pointer;
    }

    .stage-toggles {
        margin: 0 0 12px;
        padding: 10px 12px;
        color: var(--text);
        background: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .stage-toggles legend {
        padding: 0 6px;
        font-weight: 700;
        color: var(--text);
    }

    .stage-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px;
        font-weight: 600;
    }

    .stage-toggle input {
        width: 20px;
        height: 20px;
        margin: 0;
        accent-color: var(--primary-darker);
    }

    .stage-message-text {
        font-size: 18px;
        padding: 8px;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .stage-message-text::placeholder {
        color: var(--text);
        opacity: 0.5;
    }
</style>
