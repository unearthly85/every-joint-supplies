<script lang="ts">
    import { get } from "svelte/store"
    import { createEventDispatcher } from "svelte"
    import { checkName } from "../../../frontend/components/helpers/show"
    import { shows, showsCache, statusIndicator } from "../../../frontend/stores"
    import { save } from "../../../frontend/utils/save"
    import type { Show } from "../../../types/Show"
    import { defaultArrangement, parsePastedText, type SongDraft } from "./draft"
    import { extractPdfText, importableText } from "./pdf"
    import { buildLibraryShow, findSameTitle } from "./save"

    const dispatch = createEventDispatcher()

    const PART_LABELS: string[] = ["verse", "chorus", "pre_chorus", "bridge", "tag", "intro", "outro", "break"]

    let fileInput: HTMLInputElement
    let pasteText = ""
    let parseCount = 0
    let draft: SongDraft | null = null
    let title = ""
    let ccli = ""
    let author = ""
    let copyright = ""
    let partLabels: string[] = []
    let partCustom: string[] = []
    let partTexts: string[] = []
    let arrangement: string[] = []
    let pdfProblem = ""
    let problem = ""
    let duplicate: { id: string; name: string } | null = null
    let done = ""
    let saving = false

    function labelFor(index: number): string {
        const label = partLabels[index] || "verse"
        return label === "custom" ? partCustom[index] || "custom" : label
    }

    function labelName(label: string): string {
        if (label === "pre_chorus") return "Pre-chorus"
        if (label === "custom") return "Custom"
        return label.charAt(0).toUpperCase() + label.slice(1)
    }

    function partLabel(partId: string): string {
        if (!draft) return partId
        const index = draft.parts.findIndex((part) => part.id === partId)
        return index >= 0 ? labelFor(index) : partId
    }

    function setPartLabel(index: number, value: string) {
        partLabels[index] = value
        if (value === "custom" && !partCustom[index]) partCustom[index] = ""
    }

    function removeOccurrence(index: number) {
        arrangement = arrangement.filter((_, item) => item !== index)
    }

    function repeatOccurrence(index: number) {
        const partId = arrangement[index]
        if (!partId) return
        const next = arrangement.slice()
        next.splice(index + 1, 0, partId)
        arrangement = next
    }

    function currentDraft(): SongDraft | null {
        if (!draft) return null
        return {
            ...draft,
            title: (title || "").trim(),
            ccli: ccli || undefined,
            author: author || undefined,
            copyright: copyright || undefined,
            parts: draft.parts.map((part, index) => ({ ...part, label: labelFor(index), text: (partTexts[index] ?? part.text).trim() }))
        }
    }

    async function doImport() {
        if (saving) return
        problem = ""
        pdfProblem = ""
        duplicate = null
        done = ""
        let text = ""
        let fileName = ""
        const file = fileInput?.files?.[0]
        if (file) {
            fileName = file.name
            if (file.name.toLowerCase().endsWith(".pdf")) {
                const extracted = await extractPdfText(new Uint8Array(await file.arrayBuffer()))
                const guard = importableText(extracted)
                if (!guard.ok) {
                    pdfProblem = guard.message
                    return
                }
                text = extracted
            } else {
                text = await file.text()
            }
        } else {
            text = pasteText
        }
        if (!text.trim()) {
            problem = "Paste the lyrics or choose a file first."
            return
        }
        const parsed = parsePastedText(text, fileName)
        if (!parsed.parts.length) {
            problem = "No lyrics were found in that text."
            return
        }
        draft = parsed
        title = parsed.title
        ccli = parsed.ccli || ""
        author = parsed.author || ""
        copyright = parsed.copyright || ""
        partLabels = parsed.parts.map((part) => (PART_LABELS.includes(part.label) ? part.label : "custom"))
        partCustom = parsed.parts.map((part) => (PART_LABELS.includes(part.label) ? "" : part.label))
        partTexts = parsed.parts.map((part) => part.text)
        arrangement = defaultArrangement(parsed)
        parseCount += 1
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

    async function commit(show: Show & { id: string }, displayName: string) {
        saving = true
        try {
            shows.update((list) => ({
                ...list,
                [show.id]: { name: show.name, origin: show.origin, category: show.category, timestamps: show.timestamps }
            }))
            showsCache.update((cache) => ({ ...cache, [show.id]: show }))
            // A save already in progress captured the previous snapshot. Wait, then save this song too.
            await waitUntilSaveFinishes()
            save()
        } catch (error) {
            console.error(error)
            problem = "The song could not be saved. Try again."
            saving = false
            return
        }
        saving = false
        duplicate = null
        done = `Saved '${displayName}' to the song library.`
    }

    function saveDirect() {
        const current = currentDraft()
        if (!current) return
        const trimmed = (title || "").trim()
        if (!trimmed) {
            problem = "Give the song a name."
            return
        }
        const existing = findSameTitle(trimmed, get(shows))
        if (existing) {
            duplicate = existing
            return
        }
        const name = checkName(trimmed)
        void commit(buildLibraryShow(current, name, arrangement), name)
    }

    function saveAsNew() {
        const current = currentDraft()
        if (!current) return
        const trimmed = (title || "").trim()
        if (!trimmed) {
            problem = "Give the song a name."
            return
        }
        const name = checkName(trimmed)
        void commit(buildLibraryShow(current, name, arrangement), name)
    }

    function replaceExisting() {
        const current = currentDraft()
        if (!current || !duplicate) return
        const fresh = buildLibraryShow(current, duplicate.name, arrangement)
        void commit({ ...fresh, id: duplicate.id, name: duplicate.name }, duplicate.name)
    }
</script>

<div data-testid="import-screen">
    <div class="head">
        <h2>Import a song</h2>
        <button type="button" data-testid="import-back" on:click={() => dispatch("back")}>Back</button>
    </div>
    <div class="inner">
        {#if done}
            <p data-testid="import-done">{done}</p>
        {:else}
            <p>Paste the lyrics or choose a text or PDF file. Put the title first, then VERSE 1, CHORUS, and so on.</p>
            <label>
                Lyrics
                <textarea data-testid="import-paste" rows="6" placeholder="Paste the lyrics here: title first, then VERSE 1, CHORUS, ..." value={pasteText} on:change={(event) => (pasteText = event.currentTarget.value)}></textarea>
            </label>
            <label>
                Or choose a file
                <input data-testid="import-file" bind:this={fileInput} type="file" accept=".txt,.md,.pdf" on:change={() => (pdfProblem = "")} />
            </label>
            <button type="button" data-testid="import-parse" disabled={saving} on:click={doImport}>Import</button>
            {#if pdfProblem}
                <p class="problem" data-testid="import-pdf-empty">{pdfProblem}</p>
            {/if}
            {#if problem}
                <p class="problem" data-testid="import-problem">{problem}</p>
            {/if}

            {#if draft}
                {#key parseCount}
                    <div data-testid="import-preview">
                        <label>
                            Song name
                            <input data-testid="import-title" type="text" value={title} on:change={(event) => (title = event.currentTarget.value)} />
                        </label>
                        <label>
                            CCLI number
                            <input data-testid="import-ccli" type="text" value={ccli} on:change={(event) => (ccli = event.currentTarget.value)} />
                        </label>
                        <label>
                            Author
                            <input data-testid="import-author" type="text" value={author} on:change={(event) => (author = event.currentTarget.value)} />
                        </label>
                        <label>
                            Copyright
                            <input data-testid="import-copyright" type="text" value={copyright} on:change={(event) => (copyright = event.currentTarget.value)} />
                        </label>

                        {#each draft.parts as part, index}
                            <div class="part" data-testid={"import-part-" + index}>
                                <label>
                                    Part {index + 1}
                                    <select data-testid={"import-part-" + index + "-label"} value={partLabels[index]} on:change={(event) => setPartLabel(index, event.currentTarget.value)}>
                                        {#each PART_LABELS as known}
                                            <option value={known}>{labelName(known)}</option>
                                        {/each}
                                        <option value="custom">Custom</option>
                                    </select>
                                </label>
                                {#if partLabels[index] === "custom"}
                                    <label>
                                        Custom label
                                        <input data-testid={"import-part-" + index + "-custom"} type="text" value={partCustom[index] || ""} on:change={(event) => (partCustom[index] = event.currentTarget.value)} />
                                    </label>
                                {/if}
                                <label>
                                    Words
                                    <textarea data-testid={"import-part-" + index + "-text"} rows="4" value={partTexts[index] ?? part.text} on:change={(event) => (partTexts[index] = event.currentTarget.value)}></textarea>
                                </label>
                            </div>
                        {/each}

                        <h3>Order</h3>
                        {#each arrangement as partId, index}
                            <div class="arrangement" data-testid={"import-arrangement-" + index}>
                                <span>{partLabel(partId)}</span>
                                <button type="button" data-testid={"import-arrangement-" + index + "-remove"} on:click={() => removeOccurrence(index)}>Remove</button>
                                <button type="button" data-testid={"import-arrangement-" + index + "-repeat"} on:click={() => repeatOccurrence(index)}>Repeat</button>
                            </div>
                        {/each}

                        {#if duplicate}
                            <p data-testid="import-duplicate">A song called '{duplicate.name}' is already in the library.</p>
                            <div class="buttons">
                                <button type="button" data-testid="import-save-new" disabled={saving} on:click={saveAsNew}>Save as a new song</button>
                                <button type="button" data-testid="import-replace" disabled={saving} on:click={replaceExisting}>Replace the saved song</button>
                            </div>
                        {:else}
                            <button type="button" data-testid="import-save" disabled={saving} on:click={saveDirect}>Save to the song library</button>
                        {/if}
                    </div>
                {/key}
            {/if}
        {/if}
    </div>
</div>

<style>
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
    }

    h2 {
        margin: 0;
        color: var(--text);
        font-size: 22px;
    }

    h3 {
        margin: 16px 0 8px;
        color: var(--text);
        font-size: 18px;
    }

    p {
        margin: 12px 0;
    }

    label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
        font-weight: 600;
    }

    input[type="text"],
    textarea,
    select {
        font-size: 18px;
        padding: 8px;
        color: var(--text);
        background: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    textarea {
        resize: vertical;
        font-family: inherit;
        line-height: 1.4;
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

    .part {
        padding: 8px;
        margin-bottom: 12px;
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .arrangement {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        font-weight: 600;
    }

    .arrangement span {
        flex: 1;
    }

    .buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .problem {
        color: var(--red, #ff8d8d);
        font-weight: 700;
    }
</style>
