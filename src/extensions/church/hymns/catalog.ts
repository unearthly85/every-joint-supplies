import { HYMN_RECORDS } from "./bundle"
import type { HymnRecord } from "./types"
import { assertCatalogComplete } from "./validate"

/**
 * The bundled hymn catalog, checked before it is used: if any record fails
 * validation, the load throws with every error, so a bad record cannot ship
 * silently.
 */
export function loadCatalog(): HymnRecord[] {
    const errors = assertCatalogComplete(HYMN_RECORDS)
    if (errors.length) throw new Error(`hymn catalog is incomplete:\n${errors.join("\n")}`)
    return HYMN_RECORDS
}

/**
 * The hymn with this exact id, or with this title (case-insensitive,
 * trimmed). Null when the catalog has no such hymn: a title without a record
 * is refused.
 */
export function findHymn(idOrTitle: string, hymns?: HymnRecord[]): HymnRecord | null {
    const list = hymns || loadCatalog()
    const needle = (idOrTitle || "").trim()
    if (!needle) return null
    const byId = list.find((hymn) => hymn.id === needle)
    if (byId) return byId
    const title = needle.toLowerCase()
    const byTitle = list.find((hymn) => (hymn.title || "").trim().toLowerCase() === title)
    return byTitle || null
}
