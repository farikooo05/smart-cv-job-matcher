import { PDFParse } from "pdf-parse"
console.log("PDFParse:", PDFParse)
try {
    const parser = new PDFParse()
    console.log("Parser instance methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(parser)))
} catch (e) {
    console.log("Error instantiating PDFParse:", e.message)
}
