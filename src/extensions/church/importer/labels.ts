/**
 * Section-label and credits detection for lyrics pasted from Proclaim (P0-08).
 * Pure text in, text out: no stores, no UI. The importer preview builds on this.
 */

/** Normalized heading word to FreeShow group id. Keys are lowercase with spaces, so PRE-CHORUS lands on "pre chorus". */
export const KNOWN_PART_LABELS: { [word: string]: string } = {
    verse: "verse",
    chorus: "chorus",
    refrain: "chorus",
    "pre chorus": "pre_chorus",
    bridge: "bridge",
    tag: "tag",
    intro: "intro",
    outro: "outro",
    ending: "outro",
    instrumental: "break"
}

const SHORTHAND: { [letter: string]: string } = {
    V: "verse",
    C: "chorus",
    B: "bridge",
    T: "tag",
    P: "pre_chorus",
    I: "intro",
    E: "outro"
}

/** Lowercase and fold hyphens and repeated spaces so "PRE-CHORUS" and "pre chorus" compare equal. */
function normalizeWord(text: string): string {
    return text.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim()
}

/** Drop a trailing repeat marker ("x2", ": x2") and a verse number, so "VERSE 2" compares as "VERSE". */
function stripHeadingSuffix(text: string): string {
    return text
        .replace(/:\s*[xX]\d+\s*$/, "")
        .replace(/\s*[xX]\d+\s*$/, "")
        .replace(/\s+\d+\s*$/, "")
        .trim()
}

/** The group for a heading line: a FreeShow group id for known words, the custom text for Proclaim {Custom} labels, or null when the line is not a heading. */
export function detectPartLabel(line: string): string | null {
    const trimmed = (line || "").trim()
    if (!trimmed || trimmed.length > 40) return null

    const braced = /^\{(.*)\}$/.exec(trimmed)
    if (braced) {
        const inner = braced[1].trim()
        if (!inner) return null
        return KNOWN_PART_LABELS[normalizeWord(stripHeadingSuffix(inner))] || inner
    }

    const bracketed = /^\[(.*)\]$/.exec(trimmed)
    if (bracketed) {
        const inner = bracketed[1].trim()
        const known = KNOWN_PART_LABELS[normalizeWord(stripHeadingSuffix(inner))]
        if (known) return known
        return inner.includes(" ") ? inner : null
    }

    const shorthand = /^([A-Z])[0-9]?$/.exec(trimmed)
    if (shorthand) return SHORTHAND[shorthand[1]] || null

    const heading = stripHeadingSuffix(trimmed)
    if (heading.length >= 2 && /^[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*$/.test(heading)) {
        return KNOWN_PART_LABELS[normalizeWord(heading)] || null
    }
    if (heading.length >= 2 && /^[A-Z][a-z0-9]*(?:[ -][A-Za-z0-9]+)*$/.test(heading)) {
        return KNOWN_PART_LABELS[normalizeWord(heading)] || null
    }

    if (trimmed.endsWith(":")) {
        const word = trimmed.slice(0, -1).trim()
        if (word) return KNOWN_PART_LABELS[normalizeWord(stripHeadingSuffix(word))] || null
    }

    return null
}

const AUTHOR_KEYWORDS = ["written by", "words by", "lyrics by", "music by", "composer", "author"]

/** The credit lines in pasted lyrics (CCLI number, public domain, copyright, author) and their indexes, so the importer can drop them from the text. */
export function extractCredits(lines: string[]): { credits: { ccli?: string; author?: string; copyright?: string; publicDomain?: boolean }; creditIndexes: number[] } {
    const credits: { ccli?: string; author?: string; copyright?: string; publicDomain?: boolean } = {}
    const creditIndexes: number[] = []
    lines.forEach((raw, index) => {
        const line = raw.trim()
        if (!line) return
        const lower = line.toLowerCase()
        if (lower.includes("ccli") && /\d/.test(line) && line.length <= 60) {
            credits.ccli = line.match(/\d+/)?.[0]
            creditIndexes.push(index)
            return
        }
        if (lower.includes("public domain")) {
            credits.publicDomain = true
            creditIndexes.push(index)
            return
        }
        if (/^©/.test(line) || /^\(c\)/i.test(line) || /^copyright/i.test(line)) {
            credits.copyright = line
            creditIndexes.push(index)
            return
        }
        for (const keyword of AUTHOR_KEYWORDS) {
            if (new RegExp(`^${keyword}\\b`, "i").test(line)) {
                credits.author = line
                    .slice(keyword.length)
                    .replace(/^[\s:]+/, "")
                    .trim()
                creditIndexes.push(index)
                return
            }
        }
    })
    return { credits, creditIndexes }
}

/** A title for the pasted song: the first line that is not a label or a credit, then the file name, then "Untitled". */
export function proposeTitle(text: string, fileName?: string): string {
    const lines = (text || "").split("\n")
    const creditSet = new Set(extractCredits(lines).creditIndexes)
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim()
        if (!line || creditSet.has(index) || line.length > 60) continue
        if (detectPartLabel(line) !== null) continue
        return cleanTitle(line)
    }
    if (fileName) {
        const base = fileName.replace(/\.[^./\\]*$/, "").trim()
        if (base) return cleanTitle(base)
    }
    return "Untitled"
}

/** Trim, drop trailing punctuation, and cut a title over 38 chars at the last word boundary before char 30. */
function cleanTitle(raw: string): string {
    let name = raw
        .trim()
        .replace(/[.,!]+$/, "")
        .trim()
    if (name.length > 38) {
        const space = name.lastIndexOf(" ", 29)
        name = space > 0 ? name.slice(0, space) : name.slice(0, 30)
    }
    return name
}
