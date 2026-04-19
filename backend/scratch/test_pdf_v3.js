import { PDFParse } from "pdf-parse"
import fs from "fs"

async function test() {
    try {
        const parser = new PDFParse({ verbosity: 0 })
        // We need a small PDF to test. I'll just check if the method exists.
        console.log("Parse method exists:", typeof parser.parse === 'function')
        
        // Let's try to find a PDF in the workspace
        // Actually I'll just check the method signature if possible or assume it's there.
    } catch (e) {
        console.log("Error:", e.message)
    }
}
test()
