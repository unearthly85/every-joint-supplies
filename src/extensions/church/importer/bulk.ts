import { parsePastedText, type SongDraft } from "./draft"
import { parseFile } from "./formats"
import { extractPdfText, importableText } from "./pdf"

/**
 * Reading picked files into the songs-found list (P0-08 s5).
 * Pure as far as the file reads allow: files in, rows and a report line out.
 * No stores, no UI.
 */

/** A file the screen can read: the browser's File, or a stub in tests. */
export interface ReadableFile {
    name: string
    text(): Promise<string>
    arrayBuffer(): Promise<ArrayBuffer>
}

/** One row of the songs-found list: a parsed song, or the plain reason the file could not be turned into one. */
export interface FoundSong {
    title: string
    fileName: string
    status: string
    ready: boolean
    draft: SongDraft | null
}

function readySong(draft: SongDraft, fileName: string): FoundSong {
    return { title: draft.title || fileName, fileName, status: "Ready", ready: true, draft }
}

function failedSong(fileName: string, status: string): FoundSong {
    return { title: fileName, fileName, status, ready: false, draft: null }
}

/**
 * Reads one picked file into found songs. A PDF goes through the text guard
 * first, then the pasted-text parser; everything else goes through parseFile,
 * so an OpenLyrics XML may yield several songs. A file that yields nothing
 * becomes one failed row with a plain reason.
 */
export async function foundSongsFromFile(file: ReadableFile): Promise<FoundSong[]> {
    if (file.name.toLowerCase().endsWith(".pdf")) {
        const extracted = await extractPdfText(new Uint8Array(await file.arrayBuffer()))
        const guard = importableText(extracted)
        if (!guard.ok) return [failedSong(file.name, guard.message)]
        const parsed = parsePastedText(extracted, file.name)
        return parsed.parts.length > 0 ? [readySong(parsed, file.name)] : [failedSong(file.name, `No song found in ${file.name}`)]
    }
    const text = await file.text()
    const result = parseFile(file.name, text)
    if (result.error) return [failedSong(file.name, result.error)]
    const drafts = (result.drafts ?? (result.draft ? [result.draft] : [])).filter((draft) => draft.parts.length > 0)
    if (drafts.length === 0) return [failedSong(file.name, `No song found in ${file.name}`)]
    return drafts.map((draft) => readySong(draft, file.name))
}

/** Reads every picked file, in order, into the songs-found list. One file failing never stops the rest. */
export async function foundSongsFromFiles(files: ReadableFile[]): Promise<FoundSong[]> {
    const songs: FoundSong[] = []
    for (const file of files) {
        try {
            songs.push(...(await foundSongsFromFile(file)))
        } catch (error) {
            console.error(error)
            songs.push(failedSong(file.name, "The file could not be read."))
        }
    }
    return songs
}

/** The plain-language report after a bulk import, e.g. "Imported 2 songs. Skipped 1 (already in the library). 1 failed: scan.pdf." */
export function importReport(imported: number, skipped: number, failed: string[]): string {
    const parts = [imported === 1 ? "Imported 1 song." : `Imported ${imported} songs.`]
    if (skipped > 0) parts.push(`Skipped ${skipped} (already in the library).`)
    if (failed.length > 0) parts.push(`${failed.length} failed: ${failed.join(", ")}.`)
    return parts.join(" ")
}
