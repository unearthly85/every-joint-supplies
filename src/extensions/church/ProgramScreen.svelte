<script lang="ts">
    import { onMount } from "svelte"
    import { requestMain } from "../../frontend/IPC/main"
    import { outputs } from "../../frontend/stores"
    import { Main } from "../../types/IPC/Main"
    import { publishProgramScreenHooks, useScreenForProgram } from "./program/apply"
    import { programScreenChoices } from "./program/preset"
    import { displayLabel, listDisplays, type Display } from "./stage/screen"

    let displays: Display[] = []
    let loaded = false
    let on = false
    let chosenId = ""

    $: choices = programScreenChoices(displays, $outputs)
    $: if (!chosenId && choices.length > 0) chosenId = String(choices[0].id)
    $: chosen = choices.find((item) => String(item.id) === chosenId) || choices[0] || null

    onMount(async () => {
        publishProgramScreenHooks()
        displays = await listDisplays(() => requestMain(Main.GET_DISPLAYS))
        loaded = true
    })

    function useChosen() {
        if (!chosen) return
        useScreenForProgram(chosen)
        on = true
    }
</script>

<fieldset class="program-screen" data-testid="program-screen">
    <legend>Program screen</legend>
    {#if on}
        <p class="program-screen-on" data-testid="program-screen-on">The program screen is on.</p>
    {:else if loaded && choices.length === 0}
        <p class="program-screen-none" data-testid="program-no-screen">Connect a second screen for the program.</p>
    {:else}
        <label class="program-screen-label">
            Screen
            <select data-testid="program-screen-choice" bind:value={chosenId}>
                {#each choices as choice, index}
                    <option value={String(choice.id)}>{displayLabel(choice, index)}</option>
                {/each}
            </select>
        </label>
        <button type="button" data-testid="use-program-screen" on:click={useChosen}>Use this screen for the program</button>
    {/if}
</fieldset>

<style>
    .program-screen {
        margin: 0 0 12px;
        padding: 10px 12px;
        color: var(--text);
        background: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .program-screen legend {
        padding: 0 6px;
        font-weight: 700;
        color: var(--text);
    }

    .program-screen p {
        margin: 0;
    }

    .program-screen-label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
        font-weight: 600;
    }

    .program-screen-label select {
        font-size: 18px;
        padding: 8px;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .program-screen button {
        padding: 8px 12px;
        font-size: 18px;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        cursor: pointer;
    }
</style>
