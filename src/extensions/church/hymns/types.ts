/** US: works published this year or earlier are public domain as of 1 Jan 2026. */
export const PD_CUTOFF_YEAR = 1930

/** The only license a bundled hymn may carry. */
export type HymnLicense = "PD"

/** Where the hymn text was taken from: the hymnal, its year, and the exact place in it. */
export interface HymnSource {
    hymnal: string
    year: number
    location?: string
}

/** One stanza or section of a hymn, in play order. */
export interface HymnPart {
    id: string
    label: string
    text: string
}

/**
 * A verified hymn: its text, its source, and the plain reason it is public
 * domain. Every title in the catalog lives on a record like this; a title
 * without a record that passes validation cannot be loaded.
 */
export interface HymnRecord {
    id: string
    title: string
    aliases?: string[]
    firstLine?: string
    authors: string[]
    yearPublished: number
    license: HymnLicense
    source: HymnSource
    pdRationale: string
    parts: HymnPart[]
}
