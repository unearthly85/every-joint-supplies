import { expect, test } from "@playwright/test"
import { deflateSync } from "node:zlib"
import { launchChurchApp } from "./electronHarness"

const IMAGE_STREAM = "q 100 0 0 100 72 720 cm /Im1 Do Q"
const IMAGE_HEX = deflateSync(Buffer.from([255, 0, 0]))
    .toString("hex")
    .toUpperCase()

/** A tiny one-page PDF with a 1x1 image XObject and no selectable text. The same fixture as importer/pdf.test.ts. */
function buildImagePdf(): Buffer {
    const contentStream = IMAGE_STREAM
    const parts = ["%PDF-1.4\n"]
    const offsets: number[] = [0]
    const add = (num: number, body: string) => {
        offsets[num] = parts.join("").length
        parts.push(`${num} 0 obj\n${body}\nendobj\n`)
    }
    add(1, "<< /Type /Catalog /Pages 2 0 R >>")
    add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 4 0 R >>")
    add(4, `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`)
    add(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    add(6, `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${IMAGE_HEX.length} >>\nstream\n${IMAGE_HEX}\nendstream`)
    let xref = `xref\n0 7\n0000000000 65535 f \n`
    for (let i = 1; i < 7; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
    const xrefPos = parts.join("").length
    parts.push(xref, `trailer << /Size 7 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`)
    return Buffer.from(new TextEncoder().encode(parts.join("")))
}

const CHORDPRO = ["%title: Morning River", "%author: Made Up Artist", "start_of_verse:", "[C]By the [G]river in the [C]morning", "[Dm]We sing the [G]old song [C]true", "end_of_verse:", "start_of_chorus:", "[C]Morning [G]river, [F]carry us [C]home", "end_of_chorus:"].join("\n")

const OPENLYRICS = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<OPENLYRICS Format="3.2">',
    "  <SONG>",
    "    <TITLE>Second Made Up Song</TITLE>",
    '    <AUTHOR type="words">Someone Else</AUTHOR>',
    "    <CCLI>7654321</CCLI>",
    '    <SECTION type="verse" label="Verse 1">',
    "      <LINE>First line of the first verse</LINE>",
    "      <LINE>Second line of the first verse</LINE>",
    "    </SECTION>",
    '    <SECTION type="chorus" label="Chorus">',
    "      <LINE>First line of the chorus</LINE>",
    "      <LINE>Second line of the chorus</LINE>",
    "    </SECTION>",
    "  </SONG>",
    "</OPENLYRICS>"
].join("\n")

const PLAIN_TEXT = ["Third Made Up Song", "", "VERSE 1", "Line one of the third song", "Line two of the third song", "", "CHORUS", "Chorus line one", "Chorus line two"].join("\n")

test("several dropped files become a songs-found list, and the selected ones are imported", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("import-song").click()
        await window.getByTestId("import-file").setInputFiles([
            { name: "morning-river.cho", mimeType: "text/plain", buffer: Buffer.from(CHORDPRO) },
            { name: "second-song.xml", mimeType: "application/xml", buffer: Buffer.from(OPENLYRICS) }
        ])
        const rows = window.getByTestId("import-songs").locator("> .song")
        await expect(rows).toHaveCount(2)
        await expect(window.getByTestId("import-song-0")).toContainText("Morning River")
        await expect(window.getByTestId("import-song-1")).toContainText("Second Made Up Song")
        await expect(window.getByTestId("import-song-0-status")).toHaveText("Ready")
        await expect(window.getByTestId("import-song-1-status")).toHaveText("Ready")

        await window.getByTestId("import-song-0-check").click()
        await window.getByTestId("import-all").click()
        await expect(window.getByTestId("import-report")).toContainText("Imported 1 song.")
        await expect(window.getByTestId("import-song-1-status")).toHaveText("Imported")

        await window.getByTestId("start-sunday").click()
        await window.getByRole("button", { name: "Song", exact: true }).click()
        await window.getByTestId("song-search").fill("Second Made Up Song")
        const results = window.getByTestId("song-results").locator("button")
        await expect(results).toHaveCount(1)
        await window.getByTestId("song-search").fill("Morning River")
        await expect(window.getByTestId("song-results").locator("button")).toHaveCount(0)
    } finally {
        await launched.close()
    }
})

test("an image-only PDF in the batch is reported, and the rest is still imported", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("import-song").click()
        await window.getByTestId("import-file").setInputFiles([
            { name: "scan.pdf", mimeType: "application/pdf", buffer: buildImagePdf() },
            { name: "third-song.txt", mimeType: "text/plain", buffer: Buffer.from(PLAIN_TEXT) }
        ])
        await expect(window.getByTestId("import-song-0-status")).toContainText("no selectable text")
        await expect(window.getByTestId("import-song-1-status")).toHaveText("Ready")

        await window.getByTestId("import-all").click()
        await expect(window.getByTestId("import-report")).toContainText("Imported 1 song.")
        await expect(window.getByTestId("import-report")).toContainText("scan.pdf")
        await expect(window.getByTestId("import-song-1-status")).toHaveText("Imported")
        await expect(window.getByTestId("import-screen")).toBeVisible()
    } finally {
        await launched.close()
    }
})
