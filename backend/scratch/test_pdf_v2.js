import { PDFParse } from "pdf-parse"
async function test() {
    try {
        const parser = new PDFParse() 
        // If it fails on constructor, try with config
        console.log("Instantiated")
    } catch (e) {
        console.log("Failed 1:", e.message)
        try {
            const parser = new PDFParse({ verbosity: 0 })
            console.log("Instantiated with config")
        } catch (e2) {
            console.log("Failed 2:", e2.message)
        }
    }
}
test()
