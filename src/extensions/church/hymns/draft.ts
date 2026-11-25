import type { DraftPart, SongDraft } from "../importer/draft"
import type { HymnRecord } from "./types"

/**
 * The reviewable draft for a bundled hymn: its title, its stanzas as parts
 * (repeat 1, ids and labels kept), its authors, and the public domain flag.
 * Ready for the importer's show builder.
 */
export function hymnToDraft(hymn: HymnRecord): SongDraft {
    const parts: DraftPart[] = hymn.parts.map((part) => ({
        id: part.id,
        label: part.label,
        text: part.text,
        repeat: 1
    }))
    return {
        title: hymn.title,
        parts,
        author: hymn.authors.join(", "),
        publicDomain: true
    }
}
