<script lang="ts">
    import { onMount } from "svelte"
    import { requestMain } from "../../frontend/IPC/main"
    import { outputs } from "../../frontend/stores"
    import { Main } from "../../types/IPC/Main"
    import { publishStageScreenHooks, useScreenForStage } from "./stage/apply"
    import { displayLabel, listDisplays, stageScreenChoices, type Display } from "./stage/screen"

    let displays: Display[] = []
    let loaded = false
    let on = false
    let chosenId = ""

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
</style>
