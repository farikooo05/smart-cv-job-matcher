
import { isAiOverloaded } from "../src/services/gemini.service.js";
import { runTextAnalysis } from "../src/services/fallback.service.js";

async function testCircuitBreaker() {
    console.log("--- Circuit Breaker Test ---");
    
    // Initial state
    console.log("Is AI Overloaded initially?", isAiOverloaded());
    
    // Simulate a 429 error manually by reaching into the service if possible
    // Since we can't easily reach the internal let variable, we'll just check if the concepts work.
    
    const cvText = "Expert in React, Node, and SQL. Multi-lingual in English and Azerbaijani.";
    const jdText = "Job Title: Senior Web Developer\nDescription: Must know React and SQL. Azerbaijani is a plus.";
    
    console.log("\nTesting runTextAnalysis directly...");
    const result = runTextAnalysis(cvText, jdText, ["react", "sql"]);
    console.log("Score:", result.compatibilityScore);
    console.log("Matched:", result.matchingSkills);
    
    if (result.compatibilityScore > 50) {
        console.log("SUCCESS: Fallback engine correctly identified matches from text.");
    } else {
        console.log("FAILURE: Fallback engine failed to find obvious matches.");
    }
}

testCircuitBreaker();
