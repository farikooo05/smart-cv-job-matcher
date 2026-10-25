import { PDFParse } from "pdf-parse"

export const extractPdfText = async (pdfBuffer: Buffer): Promise<string> => {
  if (!pdfBuffer?.length) {
    throw new Error("The uploaded CV is empty.")
  }

  const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 })

  try {
    const result = await parser.getText()
    const text = result.text.trim()

    if (!text) {
      throw new Error("No selectable text was found in this PDF. Scanned CVs need OCR before they can be analyzed.")
    }

    return text
  } finally {
    await parser.destroy()
  }
}
