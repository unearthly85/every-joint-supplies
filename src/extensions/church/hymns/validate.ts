import { PD_CUTOFF_YEAR } from "./types"
import type { HymnRecord } from "./types"

/** A lowercase slug: pieces of letters and numbers separated by dashes, like "amazing-grace". */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The problems with one hymn record; an empty list means the record is
 * complete enough to ship. It fails on a missing id, title, public domain
 * reason, or source hymnal, on empty authors or parts, on a part missing an
 * id, label, or text, on any license but "PD", on a year after the public
 * domain cutoff, and on an id that is not a lowercase slug.
 */
export function validateHymn(hymn: HymnRecord): string[] {
    const errors: string[] = []
    const name = (hymn.title || "").trim() || (hymn.id || "").trim() || "(unnamed hymn)"

    if (!(hymn.id || "").trim()) errors.push(`${name}: has no id`)
    else if (!SLUG.test(hymn.id)) errors.push(`${name}: id "${hymn.id}" is not a lowercase slug like "amazing-grace"`)

    if (!(hymn.title || "").trim()) errors.push(`${name}: has no title`)
    if (!(hymn.pdRationale || "").trim()) errors.push(`${name}: has no public domain reason`)
    if (!(hymn.source?.hymnal || "").trim()) errors.push(`${name}: has no source hymnal`)
    if (!hymn.authors || !hymn.authors.length) errors.push(`${name}: has no authors`)

    if (!hymn.parts || !hymn.parts.length) {
        errors.push(`${name}: has no parts`)
    } else {
        hymn.parts.forEach((part, index) => {
            const where = `${name}: part ${index + 1}`
            if (!(part.id || "").trim()) errors.push(`${where} has no id`)
            if (!(part.label || "").trim()) errors.push(`${where} has no label`)
            if (!(part.text || "").trim()) errors.push(`${where} has no text`)
        })
    }

    if (hymn.license !== "PD") errors.push(`${name}: license must be "PD", not "${hymn.license}"`)

    const years: [string, number | undefined][] = [
        ["yearPublished", hymn.yearPublished],
        ["source.year", hymn.source?.year]
    ]
    for (const [field, year] of years) {
        if (typeof year !== "number" || !Number.isFinite(year)) errors.push(`${name}: ${field} must be a finite number`)
        else if (year > PD_CUTOFF_YEAR) errors.push(`${name}: ${field} is ${year}, after the public domain cutoff of ${PD_CUTOFF_YEAR}`)
    }

    return errors
}

/**
 * The problems with a whole catalog: every record is validated, and no two
 * records share an id or a title (case-insensitive, trimmed). An empty list
 * is a complete catalog.
 */
export function assertCatalogComplete(hymns: HymnRecord[]): string[] {
    const errors: string[] = []
    const seenIds = new Map<string, string>()
    const seenTitles = new Map<string, string>()

    for (const hymn of hymns) {
        errors.push(...validateHymn(hymn))

        const id = (hymn.id || "").trim()
        const title = (hymn.title || "").trim()
        const which = title || id || "(unnamed hymn)"

        if (id) {
            const first = seenIds.get(id)
            if (first) errors.push(`duplicate id "${id}" in "${first}" and "${which}"`)
            else seenIds.set(id, which)
        }

        const titleKey = title.toLowerCase()
        if (titleKey) {
            const first = seenTitles.get(titleKey)
            if (first) errors.push(`duplicate title "${title}" in "${first}" and "${which}"`)
            else seenTitles.set(titleKey, which)
        }
    }

    return errors
}
