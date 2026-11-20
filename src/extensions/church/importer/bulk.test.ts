import { deflateSync } from "node:zlib"
import { describe, expect, it, vi } from "vitest"
import { foundSongsFromFile, foundSongsFromFiles, importReport, type ReadableFile } from "./bulk"

const TEXT_STREAM = "BT /F1 24 Tf 72 720 Td (Made up song) Tj 0 -30 Td (Line one of the made up song) Tj 0 -30 Td (Line two of the made up song) Tj ET"
const IMAGE_STREAM = "q 100 0 0 100 72 720 cm /Im1 Do Q"
const IMAGE_HEX = deflateSync(Buffer.from([255, 0, 0]))
    .toString("hex")
    .toUpperCase()

/** A tiny one-page PDF: one Helvetica text object and, when given, a 1x1 image XObject. The same fixture as importer/pdf.test.ts. */
function buildPdf(contentStream: string, imageHex?: string): Uint8Array {
    const parts = ["%PDF-1.4\n"]
    const offsets: number[] = [0]
    const add = (num: number, body: string) => {
        offsets[num] = parts.join("").length
        parts.push(`${num} 0 obj\n${body}\nendobj\n`)
    }
    const resources = imageHex ? "<< /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >>" : "<< /Font << /F1 5 0 R >> >>"
    add(1, "<< /Type /Catalog /Pages 2 0 R >>")
    add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    add(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents 4 0 R >>`)
    add(4, `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`)
    add(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    let size = 6
    if (imageHex) {
        add(6, `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${imageHex.length} >>\nstream\n${imageHex}\nendstream`)
        size = 7
    }
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`
    for (let i = 1; i < size; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
    const xrefPos = parts.join("").length
    parts.push(xref, `trailer << /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`)
    return new TextEncoder().encode(parts.join(""))
}

function textFile(name: string, content: string): ReadableFile {
    return { name, text: async () => content, arrayBuffer: async () => new TextEncoder().encode(content).buffer }
}

function pdfFile(name: string, bytes: Uint8Array): ReadableFile {
    return { name, text: async () => "", arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}

const CHORDPRO = ["%title: Morning River", "%author: Made Up Artist", "start_of_verse:", "[C]By the [G]river in the [C]morning", "[Dm]We sing the [G]old song [C]true", "end_of_verse:", "start_of_chorus:", "[C]Morning [G]river, [F]carry us [C]home", "end_of_chorus:"].join("\n")

const OPENLYRICS_TWO = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<OPENLYRICS Format="3.2">',
    "  <SONG>",
    "    <TITLE>First Made Up Song</TITLE>",
    '    <AUTHOR type="words">Someone</AUTHOR>',
    "    <CCLI>1111111</CCLI>",
    '    <SECTION type="verse" label="Verse 1">',
    "      <LINE>First line of the first verse</LINE>",
    "    </SECTION>",
    "  </SONG>",
    "  <SONG>",
    "    <TITLE>Second Made Up Song</TITLE>",
    '    <SECTION type="chorus" label="Chorus">',
    "      <LINE>First line of the chorus</LINE>",
    "    </SECTION>",
    "  </SONG>",
    "</OPENLYRICS>"
].join("\n")

describe("foundSongsFromFile", () => {
    it("reads a ChordPro file into one ready song with inline chords stripped", async () => {
        const [song] = await foundSongsFromFile(textFile("morning-river.cho", CHORDPRO))
        expect(song.ready).toBe(true)
        expect(song.status).toBe("Ready")
        expect(song.title).toBe("Morning River")
        expect(song.draft?.author).toBe("Made Up Artist")
        expect(song.draft?.parts.map((part) => part.label)).toEqual(["verse", "chorus"])
        expect(song.draft?.parts[0].text).toBe("By the river in the morning\nWe sing the old song true")
    })

    it("reads an OpenLyrics XML with two songs into two ready rows, in order", async () => {
        const songs = await foundSongsFromFile(textFile("two-songs.xml", OPENLYRICS_TWO))
        expect(songs.map((song) => song.title)).toEqual(["First Made Up Song", "Second Made Up Song"])
        expect(songs.every((song) => song.ready)).toBe(true)
        expect(songs[0].draft?.ccli).toBe("1111111")
    })

    it("reads a text PDF into one ready song", async () => {
        const [song] = await foundSongsFromFile(pdfFile("made-up-song.pdf", buildPdf(TEXT_STREAM)))
        expect(song.ready).toBe(true)
        expect(song.title).toBe("Made up song")
        expect(song.draft?.parts[0].text).toBe("Line one of the made up song\nLine two of the made up song")
    })

    it("refuses an image-only PDF with the Proclaim message", async () => {
        const [song] = await foundSongsFromFile(pdfFile("scan.pdf", buildPdf(IMAGE_STREAM, IMAGE_HEX)))
        expect(song.ready).toBe(false)
        expect(song.draft).toBeNull()
        expect(song.status).toContain("no selectable text")
        expect(song.status).toContain("Proclaim")
    })

    it("fails a file with no song with the file name in the reason", async () => {
        const [song] = await foundSongsFromFile(textFile("empty.cho", "just one line of text"))
        expect(song.ready).toBe(false)
        expect(song.status).toBe("No song found in empty.cho")
        const [xml] = await foundSongsFromFile(textFile("empty.xml", "<OPENLYRICS></OPENLYRICS>"))
        expect(xml.status).toBe("No song found in empty.xml")
        const [txt] = await foundSongsFromFile(textFile("empty.txt", ""))
        expect(txt.status).toBe("No song found in empty.txt")
    })

    it("fails an unsupported file type", async () => {
        const [song] = await foundSongsFromFile(textFile("song.mp3", "x"))
        expect(song.ready).toBe(false)
        expect(song.status).toBe("Unsupported file type")
    })
})

describe("foundSongsFromFiles", () => {
    it("reads several files in order and keeps going when one fails", async () => {
        const broken: ReadableFile = {
            name: "broken.txt",
            text: async () => {
                throw new Error("read failed")
            },
            arrayBuffer: async () => new ArrayBuffer(0)
        }
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
        const songs = await foundSongsFromFiles([textFile("morning-river.cho", CHORDPRO), broken, textFile("two-songs.xml", OPENLYRICS_TWO)])
        error.mockRestore()
        expect(songs.map((song) => song.title)).toEqual(["Morning River", "broken.txt", "First Made Up Song", "Second Made Up Song"])
        expect(songs[1].status).toBe("The file could not be read.")
        expect(songs.filter((song) => song.ready).length).toBe(3)
    })

    it("returns no rows for no files", async () => {
        expect(await foundSongsFromFiles([])).toEqual([])
    })
})

describe("importReport", () => {
    it("says what was imported, skipped, and failed", () => {
        expect(importReport(2, 1, ["scan.pdf"])).toBe("Imported 2 songs. Skipped 1 (already in the library). 1 failed: scan.pdf.")
    })

    it("uses the singular for one song and drops the empty parts", () => {
        expect(importReport(1, 0, [])).toBe("Imported 1 song.")
        expect(importReport(0, 0, [])).toBe("Imported 0 songs.")
        expect(importReport(0, 2, [])).toBe("Imported 0 songs. Skipped 2 (already in the library).")
    })
})
