<script lang="ts">
    import { get } from "svelte/store"
    import { createEventDispatcher } from "svelte"
    import { checkName } from "../../../frontend/components/helpers/show"
    import { shows, showsCache, statusIndicator } from "../../../frontend/stores"
    import { save } from "../../../frontend/utils/save"
    import type { Show } from "../../../types/Show"
    import { foundSongsFromFiles, importReport, type FoundSong } from "./bulk"
    import { defaultArrangement, parsePastedText, type SongDraft } from "./draft"
    import { extractPdfText, importableText } from "./pdf"
    import { buildLibraryShow, findSameTitle } from "./save"

    type SongRow = FoundSong & { checked: boolean; done: boolean; arrangement: string[] }

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
    let songs: SongRow[] = []
    let openIndex: number | null = null
    let report = ""

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

    const SINGLE_FILE_EXTS = new Set(["txt", "md", "pdf"])

    function extOf(name: string): string {
        return name.toLowerCase().split(".").pop() ?? ""
    }

    async function handleFiles(files: File[]) {
        if (files.length === 0) return
        // A single text file keeps the one-song flow: the volunteer clicks Import as before.
        if (files.length === 1 && songs.length === 0 && SINGLE_FILE_EXTS.has(extOf(files[0].name))) {
            pdfProblem = ""
            problem = ""
            return
        }
        const found = await foundSongsFromFiles(files)
        songs = songs.concat(found.map((song) => ({ ...song, checked: song.ready, done: false, arrangement: song.draft ? defaultArrangement(song.draft) : [] })))
        report = ""
    }

    function onFilePick(event: Event) {
        const files = Array.from((event.currentTarget as HTMLInputElement).files || [])
        void handleFiles(files)
    }

    function onDrop(event: DragEvent) {
        event.preventDefault()
        void handleFiles(Array.from(event.dataTransfer?.files || []))
    }

    function setChecked(index: number, checked: boolean) {
        songs = songs.map((row, i) => (i === index ? { ...row, checked } : row))
    }

    function openSong(index: number) {
        const row = songs[index]
        if (!row || !row.draft) return
        openIndex = index
        draft = row.draft
        title = row.draft.title
        ccli = row.draft.ccli || ""
        author = row.draft.author || ""
        copyright = row.draft.copyright || ""
        partLabels = row.draft.parts.map((part) => (PART_LABELS.includes(part.label) ? part.label : "custom"))
        partCustom = row.draft.parts.map((part) => (PART_LABELS.includes(part.label) ? "" : part.label))
        partTexts = row.draft.parts.map((part) => part.text)
        arrangement = row.arrangement.length > 0 ? row.arrangement : defaultArrangement(row.draft)
        problem = ""
        pdfProblem = ""
        duplicate = null
        parseCount += 1
    }

    function closePreview() {
        openIndex = null
        draft = null
        problem = ""
        pdfProblem = ""
        duplicate = null
    }

    async function importAll() {
        if (saving) return
        report = ""
        const next = songs.map((row) => ({ ...row }))
        const selected = next.filter((row) => row.checked && row.ready && !row.done)
        if (selected.length === 0) {
            report = "Check at least one song to import."
            return
        }
        let imported = 0
        let skipped = 0
        for (const row of selected) {
            const draft = row.draft
            if (!draft) continue
            const trimmed = (draft.title || "").trim()
            if (!trimmed) {
                row.status = "Give the song a name."
                continue
            }
            if (findSameTitle(trimmed, get(shows))) {
                skipped += 1
                continue
            }
            const ok = await storeShow(buildLibraryShow(draft, checkName(trimmed), row.arrangement))
            if (ok) {
                imported += 1
                row.done = true
                row.checked = false
                row.status = "Imported"
            } else {
                row.status = "The song could not be saved. Try again."
            }
        }
        songs = next
        const failed = next.filter((row) => !row.done && row.status !== "Ready").map((row) => row.fileName)
        report = importReport(imported, skipped, failed)
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

    async function storeShow(show: Show & { id: string }): Promise<boolean> {
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
            saving = false
            return false
        }
        saving = false
        return true
    }

    async function finishSave(show: Show & { id: string }, displayName: string) {
        const ok = await storeShow(show)
        if (!ok) {
            problem = "The song could not be saved. Try again."
            return
        }
        duplicate = null
        if (openIndex !== null) {
            const rowIndex = openIndex
            openIndex = null
            draft = null
            songs = songs.map((row, index) => (index === rowIndex ? { ...row, done: true, checked: false, status: "Imported" } : row))
        } else {
            done = `Saved '${displayName}' to the song library.`
        }
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
        void finishSave(buildLibraryShow(current, name, arrangement), name)
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
        void finishSave(buildLibraryShow(current, name, arrangement), name)
    }

    function replaceExisting() {
        const current = currentDraft()
        if (!current || !duplicate) return
        const fresh = buildLibraryShow(current, duplicate.name, arrangement)
        void finishSave({ ...fresh, id: duplicate.id, name: duplicate.name }, duplicate.name)
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
            <p>Paste the lyrics or choose one or more files. Put the title first, then VERSE 1, CHORUS, and so on.</p>
            <label>
                Lyrics
                <textarea data-testid="import-paste" rows="6" placeholder="Paste the lyrics here: title first, then VERSE 1, CHORUS, ..." value={pasteText} on:change={(event) => (pasteText = event.currentTarget.value)}></textarea>
            </label>
            <label>
                Or choose files
                <input data-testid="import-file" bind:this={fileInput} type="file" multiple accept=".txt,.md,.pdf,.xml,.cho,.crd,.chopro,.usr" on:change={onFilePick} />
            </label>
            <div data-testid="import-drop" class="drop" on:dragover={(event) => event.preventDefault()} on:drop={onDrop}>Drop song files here</div>
            <button type="button" data-testid="import-parse" disabled={saving} on:click={doImport}>Import</button>
            {#if pdfProblem}
                <p class="problem" data-testid="import-pdf-empty">{pdfProblem}</p>
            {/if}
            {#if problem}
                <p class="problem" data-testid="import-problem">{problem}</p>
            {/if}

            {#if songs.length > 0}
                <h3>Songs found</h3>
                <div data-testid="import-songs">
                    {#each songs as row, index}
                        <div class="song" data-testid={"import-song-" + index}>
                            <label class="check">
                                <input type="checkbox" data-testid={"import-song-" + index + "-check"} checked={row.checked} disabled={row.done || !row.ready} on:change={(event) => setChecked(index, event.currentTarget.checked)} />
                            </label>
                            <span class="song-title">{row.title}</span>
                            <span class="song-status" data-testid={"import-song-" + index + "-status"}>{row.status}</span>
                            {#if row.ready && !row.done}
                                <button type="button" data-testid={"import-song-" + index + "-open"} on:click={() => openSong(index)}>Open</button>
                            {/if}
                        </div>
                    {/each}
                </div>
                <button type="button" data-testid="import-all" disabled={saving} on:click={() => void importAll()}>Import selected</button>
                {#if report}
                    <p data-testid="import-report">{report}</p>
                {/if}
            {/if}

            {#if draft}
                {#if openIndex !== null}
                    <button type="button" data-testid="import-back-to-list" on:click={closePreview}>Back to the list</button>
                {/if}
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

    .drop {
        padding: 16px 8px;
        margin-bottom: 12px;
        text-align: center;
        font-weight: 600;
        color: var(--text);
        background: var(--primary-darkest);
        border: 2px dashed var(--primary-lighter);
        border-radius: 8px;
    }

    .song {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        margin-bottom: 8px;
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .song label.check {
        display: flex;
        align-items: center;
        margin: 0;
    }

    .song-title {
        flex: 1;
        font-weight: 600;
    }

    .song-status {
        font-size: 16px;
    }

    .problem {
        color: var(--red, #ff8d8d);
        font-weight: 700;
    }
</style>
