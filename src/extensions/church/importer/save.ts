import { uid } from "uid"
import type { Show } from "../../../types/Show"
import { draftToShow } from "./draft"
import type { SongDraft } from "./draft"

/**
 * Turning a reviewed draft into a library song (P0-08 s4).
 * Pure as far as the stores allow: the caller passes the current song list.
 */

/** A trimmed song list, the same shape as the `shows` store. */
export type SongList = { [id: string]: { name?: string } }

/** The library song with the same name (case-insensitive, trimmed). The first match wins. */
export function findSameTitle(name: string, songs: SongList): { id: string; name: string } | null {
    const needle = (name || "").trim().toLowerCase()
    if (!needle) return null
    for (const [id, song] of Object.entries(songs)) {
        if ((song?.name || "").trim().toLowerCase() === needle) return { id, name: song.name || name }
    }
    return null
}

/**
 * The FreeShow library show for a draft. `arrangement` is the play order the
 * reviewer left; when it is missing or empty the draft's default order is used.
 * A fresh id is assigned so the show can be saved straight away.
 */
export function buildLibraryShow(draft: SongDraft, name: string, arrangement?: string[]): Show & { id: string } {
    const show = draftToShow(draft)
    show.name = name || draft.title
    show.id = uid()
    const ids = new Set(draft.parts.map((part) => part.id))
    const order = (arrangement || []).filter((id) => ids.has(id))
    if (order.length) show.layouts.arrangement.slides = order.map((id) => ({ id }))
    return show as Show & { id: string }
}
