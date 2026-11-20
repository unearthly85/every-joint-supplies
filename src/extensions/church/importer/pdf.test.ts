import { deflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { extractPdfText, importableText } from "./pdf"

const TEXT_STREAM = "BT /F1 24 Tf 72 720 Td (Line one of the made up song) Tj 0 -30 Td (Line two of the made up song) Tj ET"
const IMAGE_STREAM = "q 100 0 0 100 72 720 cm /Im1 Do Q"
const IMAGE_HEX = deflateSync(Buffer.from([255, 0, 0]))
    .toString("hex")
    .toUpperCase()

/** A tiny one-page PDF: one Helvetica text object and, when given, a 1x1 image XObject. */
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

describe("extractPdfText", () => {
    it("returns the text of a text PDF, one line per text item", async () => {
        const text = await extractPdfText(buildPdf(TEXT_STREAM))
        expect(text).toBe("Line one of the made up song\nLine two of the made up song")
    })

    it("returns no text for an image-only PDF", async () => {
        const text = await extractPdfText(buildPdf(IMAGE_STREAM, IMAGE_HEX))
        expect(text).toBe("")
    })
})

describe("importableText", () => {
    it("accepts text with at least 20 non-whitespace characters", () => {
        expect(importableText("Line one of the made up song\nLine two")).toEqual({ ok: true })
    })

    it("rejects short text with the Proclaim message", () => {
        expect(importableText("short")).toEqual({ ok: false, message: "This PDF has no selectable text. Copy the text from Proclaim instead." })
        expect(importableText("   \n  ")).toEqual({ ok: false, message: "This PDF has no selectable text. Copy the text from Proclaim instead." })
    })

    it("rejects the extracted text of an image-only PDF", async () => {
        const result = importableText(await extractPdfText(buildPdf(IMAGE_STREAM, IMAGE_HEX)))
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.message).toContain("Proclaim")
    })
})
