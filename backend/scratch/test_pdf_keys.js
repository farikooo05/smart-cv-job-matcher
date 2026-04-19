import * as pdfParse from "pdf-parse"
console.log("Keys:", Object.keys(pdfParse))
if (pdfParse.default) console.log("Has default")
if (typeof pdfParse === 'function') console.log("Is function")
console.log("Type of pdfParse:", typeof pdfParse)
