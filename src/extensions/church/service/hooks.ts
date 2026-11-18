import { churchNoteManual } from "./session"

export interface ManualTarget {
    projectIndex?: number | null
    showId?: string | null
}

/** A slide click. A locked or modified click never reaches the output. */
export function noteSlideClick(blocked: boolean, target: ManualTarget) {
    if (blocked) return
    churchNoteManual(target)
}

/** An item double-click. Edit mode, a lock, and a click on a field do not move the output. */
export function noteItemDoubleClick(blocked: boolean, target: ManualTarget) {
    if (blocked) return
    churchNoteManual(target)
}
