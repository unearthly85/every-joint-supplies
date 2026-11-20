import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf"

/**
 * Extracts the selectable text from a PDF, one line per text item.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
    if (typeof window !== "undefined") GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"
    const doc = await getDocument({ data: bytes, disableFontFace: true, useWorkerFetch: false, isEvalSupported: false }).promise
    try {
        const pages: string[] = []
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i)
            const content = await page.getTextContent()
            pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join("\n"))
        }
        return pages.join("\n")
    } finally {
        await doc.destroy()
    }
}

/**
 * Checks whether extracted PDF text is long enough to be worth importing.
 */
export function importableText(text: string): { ok: true } | { ok: false; message: string } {
    const chars = text.replace(/\s/g, "").length
    if (chars >= 20) return { ok: true }
    return { ok: false, message: "This PDF has no selectable text. Copy the text from Proclaim instead." }
}
