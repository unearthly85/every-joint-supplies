import { expect, test } from "@playwright/test"
import { deflateSync } from "node:zlib"
import { launchChurchApp } from "./electronHarness"

const TEXT_STREAM = "BT /F1 24 Tf 72 720 Td (Made up song) Tj 0 -30 Td (Line one of the made up song) Tj 0 -30 Td (Line two of the made up song) Tj ET"
const IMAGE_STREAM = "q 100 0 0 100 72 720 cm /Im1 Do Q"
const IMAGE_HEX = deflateSync(Buffer.from([255, 0, 0]))
    .toString("hex")
    .toUpperCase()

/** A tiny one-page PDF: one Helvetica text object and, when given, a 1x1 image XObject. The same fixture as importer/pdf.test.ts. */
function buildPdf(contentStream: string, imageHex?: string): Buffer {
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
    return Buffer.from(new TextEncoder().encode(parts.join("")))
}

const LYRICS = [
    "Hiding in the Light",
    "",
    "VERSE 1",
    "First line of the first verse",
    "Second line of the first verse",
    "Third line of the first verse",
    "Fourth line of the first verse",
    "",
    "CHORUS",
    "First line of the chorus",
    "Second line of the chorus",
    "Third line of the chorus",
    "Fourth line of the chorus",
    "",
    "VERSE 2",
    "First line of the second verse",
    "Second line of the second verse",
    "Third line of the second verse",
    "Fourth line of the second verse",
    "",
    "CHORUS",
    "First line of the chorus",
    "Second line of the chorus",
    "Third line of the chorus",
    "Fourth line of the chorus",
    "",
    "CCLI: 1234567"
].join("\n")

test("a pasted song is reviewed, fixed, saved, and played from the Sunday order", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("import-song").click()
        await window.getByTestId("import-paste").fill(LYRICS)
        await window.getByTestId("import-parse").click()
        await expect(window.getByTestId("import-preview")).toBeVisible()
        await expect(window.getByTestId("import-title")).toHaveValue("Hiding in the Light")
        await expect(window.getByTestId("import-ccli")).toHaveValue("1234567")
        const labels = ["verse", "chorus", "verse", "chorus"]
        for (let index = 0; index < labels.length; index += 1) {
            await expect(window.getByTestId(`import-part-${index}-label`)).toHaveValue(labels[index])
        }
        await window.getByTestId("import-part-0-label").selectOption("chorus")
        await window.getByTestId("import-save").click()
        await expect(window.getByTestId("import-done")).toContainText("Saved 'Hiding in the Light' to the song library.")
        await window.getByTestId("import-back").click()
        await window.getByTestId("service-date").fill("2026-11-22")
        await window.getByTestId("start-sunday").click()
        await window.getByRole("button", { name: "Song", exact: true }).click()
        await window.getByTestId("song-search").fill("Hiding in the Light")
        const results = window.getByTestId("song-results").locator("button")
        await expect(results).toHaveCount(1)
        await results.first().click()
        await window.getByTestId("confirm-replace").click()
        await expect(window.getByTestId("order-0")).toContainText("Chorus 1")
        await expect(window.getByTestId("order-1")).toContainText("Chorus 2")
        await expect(window.getByTestId("order-2")).toContainText("Verse")
        await expect(window.getByTestId("order-3")).toContainText("Chorus 3")
    } finally {
        await launched.close()
    }
})

test("a text PDF is imported from the chosen file", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("import-song").click()
        await window.getByTestId("import-file").setInputFiles({ name: "made-up-song.pdf", mimeType: "application/pdf", buffer: buildPdf(TEXT_STREAM) })
        await window.getByTestId("import-parse").click()
        await expect(window.getByTestId("import-preview")).toBeVisible()
        await expect(window.getByTestId("import-title")).toHaveValue("Made up song")
        await expect(window.getByTestId("import-part-0-label")).toHaveValue("verse")
        await expect(window.getByTestId("import-part-0-text")).toHaveValue("Line one of the made up song\nLine two of the made up song")
    } finally {
        await launched.close()
    }
})

test("an image-only PDF is refused with a plain message", async () => {
    const launched = await launchChurchApp()
    const window = launched.window
    try {
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("import-song").click()
        await window.getByTestId("import-file").setInputFiles({ name: "scanned-song.pdf", mimeType: "application/pdf", buffer: buildPdf(IMAGE_STREAM, IMAGE_HEX) })
        await window.getByTestId("import-parse").click()
        await expect(window.getByTestId("import-pdf-empty")).toBeVisible()
        await expect(window.getByTestId("import-pdf-empty")).toContainText("Copy the text from Proclaim instead.")
        await expect(window.getByTestId("import-preview")).toHaveCount(0)
    } finally {
        await launched.close()
    }
})
