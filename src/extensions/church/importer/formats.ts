import { detectPartLabel } from "./labels"
import { parsePastedText, type DraftPart, type SongDraft } from "./draft"

const OPENLYRICS_SECTION_TYPES: Record<string, string> = {
    verse: "verse",
    chorus: "chorus",
    bridge: "bridge",
    prechorus: "pre_chorus",
    intro: "intro",
    outro: "outro",
    ending: "outro",
    tag: "tag",
    instrumental: "break"
}

function openLyricsText(raw: string): string {
    return raw
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .trim()
}

function openLyricsSectionLabel(attrs: string): string {
    const typeMatch = /type\s*=\s*"([^"]*)"/i.exec(attrs)
    const labelMatch = /label\s*=\s*"([^"]*)"/i.exec(attrs)
    const type = (typeMatch?.[1] ?? "").replace(/[^a-z]/gi, "").toLowerCase()
    if (type === "climax") return "Climax"
    if (type === "postchorus") return "Post-Chorus"
    const mapped = OPENLYRICS_SECTION_TYPES[type]
    if (mapped) return mapped
    if (labelMatch?.[1]?.trim()) return labelMatch[1].trim()
    return "verse"
}

function openLyricsSectionLines(body: string): string[] {
    const lineMatches = Array.from(body.matchAll(/<LINE\b[^>]*>([\s\S]*?)<\/LINE>/gi))
    const raw = lineMatches.length > 0 ? lineMatches.map((m) => openLyricsText(m[1])) : openLyricsText(body).split("\n")
    return raw.map((line) => line.trim()).filter((line) => line.length > 0)
}

/**
 * Parses OpenLyrics XML (one or more <SONG> blocks) into drafts, one per song.
 */
export function parseOpenLyricsXml(xml: string): SongDraft[] {
    const normalized = xml.replace(/\r\n?/g, "\n")
    const songBlocks = Array.from(normalized.matchAll(/<SONG\b[^>]*>([\s\S]*?)<\/SONG>/gi))
    if (songBlocks.length === 0) return []
    return songBlocks.map((block) => {
        const body = block[1]
        const tag = (name: string): string | undefined => {
            const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(body)
            return match ? openLyricsText(match[1]) : undefined
        }
        const title = tag("TITLE") ?? "Untitled"
        const authorMatch = /<AUTHOR\b[^>]*type\s*=\s*"words"[^>]*>([\s\S]*?)<\/AUTHOR>/i.exec(body)
        const author = authorMatch ? openLyricsText(authorMatch[1]) : undefined
        const ccli = tag("CCLI")
        const copyright = tag("COPYRIGHT")
        const parts: DraftPart[] = []
        for (const section of Array.from(body.matchAll(/<SECTION\b([^>]*)>([\s\S]*?)<\/SECTION>/gi))) {
            const lines = openLyricsSectionLines(section[2])
            if (lines.length === 0) continue
            parts.push({ id: `part-${parts.length + 1}`, label: openLyricsSectionLabel(section[1]), text: lines.join("\n") })
        }
        const draft: SongDraft = { title, parts }
        if (author) draft.author = author
        if (ccli) draft.ccli = ccli
        if (copyright) draft.copyright = copyright
        if (copyright && /public domain/i.test(copyright)) draft.publicDomain = true
        return draft
    })
}

type ChordProMeta = { title?: string; author?: string; copyright?: string; ccli?: string }

const CHORDPRO_META_KEYS = ["title", "author", "copyright", "ccli"] as const

const CHORDPRO_START_TYPES: Record<string, string> = {
    verse: "verse",
    chorus: "chorus",
    bridge: "bridge",
    prechorus: "pre_chorus",
    pre_chorus: "pre_chorus",
    intro: "intro",
    outro: "outro",
    ending: "outro",
    tag: "tag",
    instrumental: "break"
}

function chordProMarkerLabel(raw: string): { label: string; repeat: number } {
    let text = raw.trim()
    let repeat = 1
    const times = /\((\d+)\s*x\)|\bx(\d+)\s*$/i.exec(text)
    if (times) {
        repeat = parseInt(times[1] ?? times[2] ?? "1", 10)
        text = text.replace(times[0], "").trim()
    }
    const detected = detectPartLabel(text)
    return { label: detected ?? (text.length > 0 ? text : "verse"), repeat }
}

function chordProStartLabel(name: string): string {
    const key = name.toLowerCase()
    const mapped = CHORDPRO_START_TYPES[key]
    if (mapped) return mapped
    return key.replace(/_/g, " ")
}

/**
 * Parses ChordPro text: {c:Label} markers, start_of_/end_of_ pairs, bare
 * heading lines, and % metadata lines. Inline [Chord] markers are stripped.
 * Returns null when no section markers are found at all.
 */
export function parseChordPro(text: string, fileName?: string): SongDraft | null {
    const parts: DraftPart[] = []
    const meta: ChordProMeta = {}
    let current: { label: string; repeat: number; lines: string[] } | null = null
    let foundSection = false

    const closePart = () => {
        if (!current) return
        const body = current.lines.join("\n").trim()
        if (body.length > 0) parts.push({ id: `part-${parts.length + 1}`, label: current.label, text: body, repeat: current.repeat })
        current = null
    }
    const openPart = (label: string, repeat: number, counted: boolean) => {
        closePart()
        current = { label, repeat, lines: [] }
        if (counted) foundSection = true
    }

    for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
        const line = rawLine.trim()
        if (line.length === 0) continue
        const metaMatch = /^%([A-Za-z]+)\s*:\s*(.*)$/.exec(line)
        if (metaMatch) {
            const key = metaMatch[1].toLowerCase()
            const value = metaMatch[2].trim()
            if ((CHORDPRO_META_KEYS as readonly string[]).includes(key) && value.length > 0) meta[key as keyof ChordProMeta] = value
            continue
        }
        const markerMatch = /^\{c:(.+)\}$/i.exec(line)
        if (markerMatch) {
            const { label, repeat } = chordProMarkerLabel(markerMatch[1])
            openPart(label, repeat, true)
            continue
        }
        const startMatch = /^start_of_([A-Za-z0-9_]+)\s*:?\s*$/i.exec(line)
        if (startMatch) {
            openPart(chordProStartLabel(startMatch[1]), 1, true)
            continue
        }
        if (/^end_of_[A-Za-z0-9_]+\s*:?\s*$/i.test(line)) {
            closePart()
            continue
        }
        const heading = detectPartLabel(line)
        if (heading) {
            openPart(heading, 1, true)
            continue
        }
        const words = line
            .replace(/\[\s*\/\s*\]/g, " ")
            .replace(/\[[^\]]*\]/g, "")
            .trim()
        if (words.length > 0) {
            if (!current) openPart("verse", 1, false)
            if (current) current.lines.push(words)
        }
    }
    closePart()
    if (!foundSection) return null

    const draft: SongDraft = { title: meta.title ?? (fileName ? fileName.replace(/\.[^.]+$/, "") : "Untitled"), parts }
    if (meta.author) draft.author = meta.author
    if (meta.copyright) draft.copyright = meta.copyright
    if (meta.ccli) draft.ccli = meta.ccli
    if (meta.copyright && /public domain/i.test(meta.copyright)) draft.publicDomain = true
    return draft
}

function usrAuthors(raw: string): string {
    let list = raw.split("/")
    if (list.length < 2) list = raw.split("|")
    return list
        .map((part) => {
            const separated = part.split(",")
            if (separated.length > 1)
                return separated
                    .map((piece) => piece.trim())
                    .reverse()
                    .join(" ")
            return part.trim()
        })
        .filter((author) => author.length > 0)
        .join(", ")
}

function usrPartLabel(field: string, firstLine: string): { label: string; dropFirstLine: boolean } {
    if (/^ver/i.test(field)) return { label: "verse", dropFirstLine: false }
    if (/^ch/i.test(field)) return { label: "chorus", dropFirstLine: false }
    if (/^br/i.test(field)) return { label: "bridge", dropFirstLine: false }
    if (/^\(pre-chorus/i.test(firstLine)) return { label: "pre_chorus", dropFirstLine: true }
    if (/^\(bridge/i.test(firstLine)) return { label: "bridge", dropFirstLine: true }
    const paren = /^\(([^)]*)\)/.exec(firstLine)
    if (paren && paren[1].trim().length > 0) return { label: paren[1].trim(), dropFirstLine: true }
    return { label: field.length > 0 ? field : "verse", dropFirstLine: false }
}

function parseSongSelectUsr(text: string): SongDraft | null {
    let title = ""
    let author = ""
    let copyright = ""
    let ccli = ""
    let fields: string[] = []
    let words: string[] = []
    let sawHeader = false

    for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
        const line = rawLine.trim()
        if (line.length === 0) continue
        if (/^\[S\s/i.test(line)) {
            sawHeader = true
            const number = line
                .replace(/^\[S\s*/i, "")
                .replace(/\]\s*$/, "")
                .replace(/^A/i, "")
            if (/^\d+$/.test(number)) ccli = number
            continue
        }
        if (line.startsWith("Title=")) {
            sawHeader = true
            title = line.slice("Title=".length).trim()
            continue
        }
        if (line.startsWith("Author=")) {
            sawHeader = true
            author = usrAuthors(line.slice("Author=".length))
            continue
        }
        if (line.startsWith("Copyright=")) {
            sawHeader = true
            copyright = line.slice("Copyright=".length).trim()
            continue
        }
        if (line.startsWith("Fields=")) {
            sawHeader = true
            fields = line
                .slice("Fields=".length)
                .split("/t")
                .map((field) => field.trim())
                .filter((field) => field.length > 0)
            continue
        }
        if (line.startsWith("Words=")) {
            sawHeader = true
            words = line
                .slice("Words=".length)
                .split("/t")
                .map((word) => word.replace(/\/n/g, "\n").replace(/ \| /g, "\n"))
            continue
        }
    }
    if (!sawHeader) return null

    const parts: DraftPart[] = []
    const count = Math.min(fields.length, words.length)
    for (let i = 0; i < count; i++) {
        const rawLines = words[i].split("\n").map((line) => line.trim())
        const firstLine = rawLines[0] ?? ""
        const { label, dropFirstLine } = usrPartLabel(fields[i], firstLine)
        const lines = (dropFirstLine ? rawLines.slice(1) : rawLines).filter((line) => line.length > 0)
        if (lines.length === 0) continue
        parts.push({ id: `part-${parts.length + 1}`, label, text: lines.join("\n") })
    }
    if (title.length === 0 && parts.length === 0) return null

    const draft: SongDraft = { title: title.length > 0 ? title : "Untitled", parts }
    if (ccli) draft.ccli = ccli
    if (author) draft.author = author
    if (copyright) draft.copyright = copyright
    if (copyright && /public domain/i.test(copyright)) draft.publicDomain = true
    return draft
}

/**
 * Parses a SongSelect export: .usr files use the SongSelect import file
 * layout, .txt files are plain lyrics with an optional CCLI/copyright/author
 * header (or no header at all).
 */
export function parseSongSelect(text: string, fileName?: string): SongDraft | null {
    if (!text || text.trim().length === 0) return null
    const ext = (fileName ?? "").toLowerCase().split(".").pop() ?? ""
    if (ext === "usr") return parseSongSelectUsr(text) ?? parsePastedText(text, fileName)
    return parsePastedText(text, fileName)
}

export interface ParseFileResult {
    draft?: SongDraft
    drafts?: SongDraft[]
    error?: string
}

/**
 * Chooses the right parser for a file name and content.
 */
export function parseFile(name: string, content: string): ParseFileResult {
    const ext = name.toLowerCase().split(".").pop() ?? ""
    if (ext === "xml") {
        const drafts = parseOpenLyricsXml(content)
        return drafts.length > 0 ? { drafts } : { error: `No song found in ${name}` }
    }
    if (ext === "cho" || ext === "crd" || ext === "chopro") {
        const draft = parseChordPro(content, name)
        return draft ? { draft } : { error: `No song found in ${name}` }
    }
    if (ext === "usr" || ext === "txt" || ext === "md") {
        const draft = parseSongSelect(content, name)
        return draft ? { draft } : { error: `No song found in ${name}` }
    }
    return { error: "Unsupported file type" }
}
