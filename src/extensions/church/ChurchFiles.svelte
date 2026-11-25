<script lang="ts">
    import { onMount } from "svelte"
    import { createChurchKeyClient, type ChurchApi } from "./keys/client"
    import type { ChurchKeyStatus } from "./keys/churchKeys"

    const api = (window as unknown as { api: ChurchApi }).api
    const request = createChurchKeyClient(api)

    let status: ChurchKeyStatus | null = null
    let problem = ""
    let busy = false

    // "none": the setup form
    let churchName = ""
    let passphrase = ""
    let passphraseAgain = ""

    // "setup": the recovery code, shown once
    let recoveryCode = ""
    let recoveryWritten = false
    let typedGroup = ""

    // "locked"
    let unlockSecret = ""

    // "unlocked"
    let copyResult = ""

    onMount(() => {
        request("status")
            .then((s: ChurchKeyStatus) => {
                status = s
            })
            .catch((err: unknown) => {
                problem = message(err)
            })
    })

    function message(err: unknown): string {
        return err instanceof Error ? err.message : "The church files did not answer. Try again."
    }

    function clearSetup() {
        recoveryCode = ""
        recoveryWritten = false
        typedGroup = ""
    }

    async function setup() {
        if (busy) return
        problem = ""
        if (passphrase !== passphraseAgain) {
            problem = "The passphrases do not match."
            return
        }
        busy = true
        try {
            const result = await request("startSetup", { churchName, passphrase })
            recoveryCode = result.recoveryCode
            recoveryWritten = false
            typedGroup = ""
            status = { state: "setup", churchName, checkGroup: result.checkGroup }
        } catch (err) {
            problem = message(err)
        } finally {
            passphrase = ""
            passphraseAgain = ""
            busy = false
        }
    }

    async function finishSetup() {
        if (busy) return
        problem = ""
        busy = true
        try {
            status = await request("finishSetup", { group: typedGroup })
            clearSetup()
        } catch (err) {
            problem = message(err)
        } finally {
            busy = false
        }
    }

    async function cancelSetup() {
        if (busy) return
        problem = ""
        busy = true
        try {
            status = await request("cancelSetup")
            clearSetup()
        } catch (err) {
            problem = message(err)
        } finally {
            busy = false
        }
    }

    async function unlock() {
        if (busy) return
        problem = ""
        busy = true
        try {
            status = await request("unlock", { secret: unlockSecret })
        } catch (err) {
            problem = message(err)
        } finally {
            unlockSecret = ""
            busy = false
        }
    }

    async function saveCopy() {
        if (busy) return
        problem = ""
        busy = true
        try {
            const result = await request("saveChurchCopy")
            copyResult = "Saved " + result.count + " items to the church copy."
        } catch (err) {
            problem = message(err)
        } finally {
            busy = false
        }
    }

    async function forget() {
        if (busy) return
        problem = ""
        busy = true
        try {
            status = await request("forget")
            copyResult = ""
        } catch (err) {
            problem = message(err)
        } finally {
            busy = false
        }
    }
</script>

<section class="church-files" data-testid="church-files">
    <h2>Church files</h2>

    {#if status === null}
        <p>Checking the church files…</p>
    {:else if status.state === "none"}
        <p>Protect this church's service files. Choose a passphrase the church will keep.</p>
        <label>
            Church name
            <input data-testid="church-name" type="text" value={churchName} on:input={(e) => (churchName = e.currentTarget.value)} />
        </label>
        <label>
            Passphrase
            <input data-testid="church-passphrase" type="password" value={passphrase} on:input={(e) => (passphrase = e.currentTarget.value)} />
        </label>
        <label>
            Type it again
            <input data-testid="church-passphrase-again" type="password" value={passphraseAgain} on:input={(e) => (passphraseAgain = e.currentTarget.value)} />
        </label>
        <button type="button" data-testid="church-setup" disabled={busy} on:click={setup}>Set up</button>
    {:else if status.state === "setup"}
        {#if recoveryCode}
            <p class="recovery-code" data-testid="recovery-code">{recoveryCode}</p>
            <p>Write this recovery code on paper and keep it with the church records. It opens the church files if the passphrase is lost.</p>
            <button type="button" data-testid="recovery-written" disabled={busy} on:click={() => (recoveryWritten = true)}>I wrote it down</button>
        {:else}
            <p>The recovery code was shown once, at setup. Cancel to start again.</p>
        {/if}
        {#if recoveryWritten && recoveryCode}
            <label data-testid="recovery-group-label">
                Type group {status.checkGroup} of the code
                <input data-testid="recovery-group" type="text" value={typedGroup} on:input={(e) => (typedGroup = e.currentTarget.value)} />
            </label>
            <button type="button" data-testid="church-finish" disabled={busy} on:click={finishSetup}>Finish</button>
        {/if}
        <button type="button" data-testid="church-setup-cancel" disabled={busy} on:click={cancelSetup}>Cancel</button>
    {:else if status.state === "locked"}
        <p>Type the church passphrase or the recovery code.</p>
        <label>
            <input data-testid="church-unlock-secret" type="password" aria-label="Church passphrase or recovery code" value={unlockSecret} on:input={(e) => (unlockSecret = e.currentTarget.value)} />
        </label>
        <button type="button" data-testid="church-unlock" disabled={busy} on:click={unlock}>Open</button>
    {:else}
        <p data-testid="church-unlocked">{status.churchName}: church files are protected.</p>
        {#if status.remembered}
            <p>This computer remembers it.</p>
        {:else}
            <p>This computer will ask for the passphrase each time it starts.</p>
        {/if}
        <button type="button" data-testid="church-save-copy" disabled={busy} on:click={saveCopy}>Save church copy</button>
        {#if copyResult}
            <p data-testid="church-copy-result">{copyResult}</p>
        {/if}
        {#if status.remembered}
            <button type="button" data-testid="church-forget" disabled={busy} on:click={forget}>Forget on this computer</button>
        {/if}
    {/if}

    {#if problem}
        <p class="problem" data-testid="church-files-problem">{problem}</p>
    {/if}
</section>

<style>
    .church-files {
        margin: 12px 0 0;
        padding: 10px 12px;
        color: var(--text);
        background: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .church-files h2 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 700;
        color: var(--text);
    }

    .church-files p {
        margin: 0 0 8px;
        font-size: 14px;
        line-height: 1.35;
    }

    .church-files label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 600;
    }

    .church-files input {
        font-size: 16px;
        padding: 6px 8px;
        color: var(--text);
        background: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .church-files button {
        padding: 6px 10px;
        font-size: 15px;
        color: var(--text);
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        cursor: pointer;
    }

    .church-files .recovery-code {
        font-family: monospace;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 1px;
    }

    .church-files .problem {
        color: var(--red, #ff8d8d);
        font-weight: 700;
    }
</style>
