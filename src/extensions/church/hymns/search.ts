import { loadCatalog } from "./catalog"
import type { HymnRecord } from "./types"

/**
 * A title with case, punctuation, and parentheses stripped, so a
 * Hymnbase-style name like "Amazing Grace (How Sweet the Sound)!" becomes
 * the same string as "amazing grace how sweet the sound".
 */
export function normalizeTitle(value: string): string {
    return (value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/ {2,}/g, " ")
        .trim()
}

/**
 * Every name a volunteer might type for a hymn: its title, its aliases,
 * and its first line when it has one, each as the original string.
 */
export function titlesOf(hymn: HymnRecord): string[] {
    const names = [hymn.title, ...(hymn.aliases || [])]
    if (hymn.firstLine) names.push(hymn.firstLine)
    return names
}

/**
 * The single best hymn for a Hymnbase-style title lookup: an exact
 * normalized id, then an exact normalized title, then an exact normalized
 * alias, then a unique "starts with" hit on a title or alias, then a unique
 * "contains" hit on a title, alias, or first line. Two hymns tied at the
 * winning tier give null rather than a guess.
 */
export function matchTitle(query: string, hymns?: HymnRecord[]): HymnRecord | null {
    const needle = normalizeTitle(query)
    if (!needle) return null
    const list = hymns || loadCatalog()

    const tiers: HymnRecord[][] = [list.filter((hymn) => normalizeTitle(hymn.id) === needle), list.filter((hymn) => normalizeTitle(hymn.title) === needle), list.filter((hymn) => (hymn.aliases || []).some((alias) => normalizeTitle(alias) === needle)), list.filter((hymn) => [hymn.title, ...(hymn.aliases || [])].some((name) => normalizeTitle(name).startsWith(needle))), list.filter((hymn) => titlesOf(hymn).some((name) => normalizeTitle(name).includes(needle)))]
    for (const tier of tiers) {
        if (tier.length) return tier.length === 1 ? tier[0] : null
    }
    return null
}

/**
 * The hymn list for a type-ahead box: every hymn whose title, alias, id,
 * or first line contains the query, best matches first (exact title or
 * alias, then title starts with the query, then the rest), ties by title
 * alphabetically, one row per hymn, capped at limit.
 */
export function searchHymns(query: string, hymns?: HymnRecord[], limit = 8): HymnRecord[] {
    const needle = normalizeTitle(query)
    if (!needle) return []
    const list = hymns || loadCatalog()

    const rank = (hymn: HymnRecord): number => {
        const names = [hymn.title, ...(hymn.aliases || [])]
        if (names.some((name) => normalizeTitle(name) === needle)) return 0
        if (normalizeTitle(hymn.title).startsWith(needle)) return 1
        return 2
    }

    const matches = list.filter((hymn) => [hymn.title, ...(hymn.aliases || []), hymn.id, hymn.firstLine || ""].filter((name) => name).some((name) => normalizeTitle(name).includes(needle)))

    const sorted = [...matches].sort((a, b) => {
        const diff = rank(a) - rank(b)
        if (diff) return diff
        return (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" })
    })

    const seen = new Set<string>()
    const found: HymnRecord[] = []
    for (const hymn of sorted) {
        if (seen.has(hymn.id)) continue
        seen.add(hymn.id)
        found.push(hymn)
        if (found.length === limit) break
    }
    return found
}
