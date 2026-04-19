import { runBasicAnalysis } from "../src/services/fallback.service.js"
import fs from "fs"

async function verify() {
    console.log("--- Verification Start ---")
    
    // Create a mock PDF buffer (just enough to not crash or we can use a real one)
    // Actually, I'll try to find a real PDF in the workspace if possible.
    const samplePdfPath = "./scratch/sample.pdf"
    
    // If we don't have a real PDF, we can't fully test parsing, 
    // but we can check if the function is exported correctly and accepts the new param.
    console.log("Testing function signature...")
    
    const jobDescription = "We are looking for a Next.js developer with expertise in CustomSkill."
    const userSkills = ["CustomSkill", "Next.js"]
    
    console.log("Function exists:", typeof runBasicAnalysis === 'function')
    
    // Note: This will likely fail on parser.parse because of invalid buffer, 
    // but it confirms the code compiles and the imports work.
    try {
        // Mock buffer
        const mockBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj")
        await runBasicAnalysis(mockBuffer, jobDescription, userSkills)
    } catch (e: any) {
        console.log("Expected partial failure (invalid buffer), but code reached execution:", e.message)
    }
    
    console.log("--- Verification End ---")
}

verify()
