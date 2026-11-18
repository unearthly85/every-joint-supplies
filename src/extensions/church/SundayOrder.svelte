<script lang="ts">
    import { get } from "svelte/store"
    import { outputs, projects, shows, showsCache } from "../../frontend/stores"
    import { loadShows } from "../../frontend/components/helpers/setShow"
    import { appendPart, applyServiceSequence, arrangementName, layoutForOrder, movePart, nextAfterJump, nextHint, orderTitles, readLayoutOrder, saveAsNewArrangement, skipPart, songChoices } from "./service/arrangement"

    export let showId = ""

    $: projectId = Object.keys($projects).find((id) => $projects[id]?.shows?.some((ref) => ref.id === showId)) || ""
    $: itemIndex = projectId ? ($projects[projectId]?.shows || []).findIndex((ref) => ref.id === showId) : -1
    $: blob = itemIndex >= 0 ? $projects[projectId]?.shows?.[itemIndex]?.data?.church : null
    $: song = blob?.itemType === "song" ? $showsCache[showId] : null
    $: layoutId = song?.settings?.activeLayout || ""
    $: order = song ? readLayoutOrder(song, layoutId) : []
    $: labels = Object.fromEntries(Object.entries(song?.slides || {}).map(([id, slide]) => [id, slide.group && slide.group !== "." ? slide.group : "slide"]))
    $: titles = orderTitles(order, labels, Object.keys(song?.slides || {}))
    $: serviceDate = ($projects[projectId] as { church?: { date?: string } } | undefined)?.church?.date || ""
    let query = ""
    let pendingId = ""
    $: matches = songChoices(
        Object.entries($shows).map(([id, show]) => ({ id, name: show?.name, origin: show?.origin, category: show?.category })),
        showId,
        query
    )

    $: liveIndex = liveSlideIndex(showId, $outputs)
    $: next = liveIndex == null ? null : nextAfterJump(order, labels, liveIndex)
    $: hint = nextHint(liveIndex != null, next?.title || null, titles[0] || null)
    $: dragged = -1

    function liveSlideIndex(id: string, outs: typeof $outputs): number | null {
        for (const output of Object.values(outs || {})) {
            const slide = output?.out?.slide
            if (slide?.id === id && typeof slide.index === "number") return slide.index
        }
        return null
    }

    function commit(ids: string[]) {
        if (!song || !layoutId) return
        showsCache.update((all) => {
            const current = all[showId]
            const layout = current?.layouts?.[layoutId]
            if (!current || !layout) return all
            layout.slides = layoutForOrder(layout.slides || [], ids)
            return all
        })
        if (!projectId || itemIndex < 0) return
        projects.update((all) => {
            const ref = all[projectId]?.shows?.[itemIndex]
            if (!ref?.data?.church) return all
            ref.data.church.arrangement = ids
            return all
        })
    }

    function add(label: string) {
        const wanted = label.toLowerCase()
        const partId = Object.keys(labels).find((id) => (labels[id] || "").toLowerCase() === wanted) || ""
        if (partId) commit(appendPart(order, partId))
    }

    async function useLibrary(id: string) {
        await loadShows([id])
        const library = get(showsCache)[id]
        if (!library || !song) return
        const sequence = readLayoutOrder(library)
        const opened = applyServiceSequence(library, sequence)
        showsCache.update((all) => {
            const current = all[showId]
            if (!current) return all
            all[showId] = { ...opened, name: current.name, origin: current.origin, category: current.category, timestamps: current.timestamps }
            return all
        })
        projects.update((all) => {
            const ref = all[projectId]?.shows?.[itemIndex]
            if (!ref?.data?.church) return all
            ref.name = library.name || ref.name
            ref.data.church.arrangement = sequence
            ref.data.church.libraryShowId = id
            ref.data.church.parts = Object.entries(opened.slides).map(([partId, slide]) => ({
                id: partId,
                label: slide.group && slide.group !== "." ? slide.group : "verse",
                text: ""
            }))
            return all
        })
    }

    function saveArrangement() {
        const libraryId = blob?.libraryShowId
        if (!libraryId) return
        const library = get(showsCache)[libraryId]
        if (!library) return
        const existing = Object.values(library.layouts || {}).map((layout) => layout?.name || "")
        const saved = saveAsNewArrangement(library, arrangementName(serviceDate, existing), order)
        showsCache.update((all) => {
            all[libraryId] = saved
            return all
        })
    }

    function chooseSong(id: string) {
        if (order.length) {
            pendingId = id
            return
        }
        void useLibrary(id)
    }

    function allowDrop(event: DragEvent) {
        event.preventDefault()
    }
</script>

{#if song}
    <section class="order" data-testid="sunday-order" aria-label="This Sunday's order">
        <h2>This Sunday's order</h2>
        <p data-testid="next-part">{hint}</p>
        <ol>
            {#each titles as title, index}
                <li
                    draggable="true"
                    data-testid={"order-" + index}
                    on:dragstart={() => (dragged = index)}
                    on:dragover={allowDrop}
                    on:drop={() => {
                        if (dragged >= 0) commit(movePart(order, dragged, index))
                        dragged = -1
                    }}
                >
                    <span>{title}</span>
                    <button type="button" data-testid={"up-" + index} disabled={index === 0} on:click={() => commit(movePart(order, index, index - 1))}>Up</button>
                    <button type="button" data-testid={"down-" + index} disabled={index === titles.length - 1} on:click={() => commit(movePart(order, index, index + 1))}>Down</button>
                    <button type="button" data-testid={"skip-" + index} on:click={() => commit(skipPart(order, index))}>Skip</button>
                </li>
            {/each}
        </ol>
        <div class="actions">
            <button type="button" data-testid="add-chorus" on:click={() => add("chorus")}>Add a chorus</button>
            <button type="button" data-testid="add-tag" on:click={() => add("tag")}>Add a tag</button>
            {#if blob?.libraryShowId}
                <button type="button" data-testid="save-arrangement" on:click={saveArrangement}>Save as new arrangement</button>
            {/if}
        </div>
        <div class="saved">
            <label>
                Start from a saved song
                <input data-testid="song-search" placeholder="Search songs" bind:value={query} />
            </label>
            <div data-testid="song-results">
                {#each matches as saved}
                    <button type="button" data-testid={"song-result-" + saved.id} on:click={() => chooseSong(saved.id)}>{saved.name}</button>
                {/each}
            </div>
            {#if pendingId}
                <p>Replace this Sunday's song with {matches.find((item) => item.id === pendingId)?.name || "this song"}?</p>
                <button type="button" data-testid="confirm-replace" on:click={() => { const id = pendingId; pendingId = ""; void useLibrary(id) }}>Replace song</button>
                <button type="button" data-testid="cancel-replace" on:click={() => (pendingId = "")}>Keep this song</button>
            {/if}
        </div>
    </section>
{/if}

<style>
    .order {
        padding: 8px 12px;
        background: var(--primary);
        color: var(--text);
        border-bottom: 1px solid var(--primary-lighter);
    }

    h2,
    p {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 600;
    }

    ol {
        list-style: none;
        margin: 0 0 8px;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    li {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: var(--primary-darker);
        border-radius: 4px;
    }

    button {
        font: inherit;
        color: var(--text);
        background: var(--primary-lighter);
        border: 0;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
    }

    .actions,
    .saved {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }

    .saved {
        margin-top: 8px;
    }

    .saved label {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 6px;
    }

    input {
        flex: 1;
        width: 100%;
        background-color: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        padding: 5px 10px;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        outline-offset: -2px;
    }

    input::placeholder {
        color: var(--text);
        opacity: 0.5;
    }

    input:focus {
        outline: 2px solid var(--secondary);
    }
</style>
