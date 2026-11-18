<script lang="ts">
    import { get } from "svelte/store"
    import { outputs, projects, shows, showsCache } from "../../frontend/stores"
    import { loadShows } from "../../frontend/components/helpers/setShow"
    import { appendPart, applyServiceSequence, layoutForOrder, movePart, nextAfterJump, readLayoutOrder, saveAsNewArrangement, skipPart, titleAt } from "./service/arrangement"

    export let showId = ""

    $: projectId = Object.keys($projects).find((id) => $projects[id]?.shows?.some((ref) => ref.id === showId)) || ""
    $: itemIndex = projectId ? ($projects[projectId]?.shows || []).findIndex((ref) => ref.id === showId) : -1
    $: blob = itemIndex >= 0 ? $projects[projectId]?.shows?.[itemIndex]?.data?.church : null
    $: song = blob?.itemType === "song" ? $showsCache[showId] : null
    $: layoutId = song?.settings?.activeLayout || ""
    $: order = song ? readLayoutOrder(song, layoutId) : []
    $: labels = Object.fromEntries(Object.entries(song?.slides || {}).map(([id, slide]) => [id, slide.group && slide.group !== "." ? slide.group : "slide"]))
    $: librarySongs = Object.entries($shows).filter(([id, show]) => id !== showId && show?.name && show.origin !== "church-service")

    $: liveIndex = liveSlideIndex(showId, $outputs)
    $: next = liveIndex == null ? null : nextAfterJump(order, labels, liveIndex)
    $: dragged = -1

    function liveSlideIndex(id: string, outs: typeof $outputs): number | null {
        for (const output of Object.values(outs || {})) {
            const slide = output?.out?.slide
            if (slide?.id === id && typeof slide.index === "number") return slide.index
        }
        return null
    }

    function titles(ids: string[]): string[] {
        return ids.map((_, index) => titleAt(ids, labels, index))
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
        const saved = saveAsNewArrangement(library, "This Sunday", order)
        showsCache.update((all) => {
            all[libraryId] = saved
            return all
        })
    }

    function allowDrop(event: DragEvent) {
        event.preventDefault()
    }
</script>

{#if song}
    <section class="order" data-testid="sunday-order" aria-label="This Sunday's order">
        <h2>This Sunday's order</h2>
        <p data-testid="next-part">{next ? `Next: ${next.title}` : order.length ? `Next: ${titles(order)[0]}` : "Next: —"}</p>
        <ol>
            {#each titles(order) as title, index}
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
        {#if librarySongs.length}
            <div class="saved">
                <p>Start from a saved song</p>
                {#each librarySongs as [id, saved]}
                    <button type="button" data-testid={"use-library-" + id} on:click={() => useLibrary(id)}>{saved.name}</button>
                {/each}
            </div>
        {/if}
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
</style>
