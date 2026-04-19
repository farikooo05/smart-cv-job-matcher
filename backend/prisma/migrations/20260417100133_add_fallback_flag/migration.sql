-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "cvFileName" TEXT NOT NULL,
    "compatibilityScore" INTEGER NOT NULL,
    "matchedSkillsCount" INTEGER NOT NULL,
    "missingSkillsCount" INTEGER NOT NULL,
    "cvKeywords" TEXT NOT NULL,
    "jdKeywords" TEXT NOT NULL,
    "matchingSkills" TEXT NOT NULL,
    "missingRequirements" TEXT NOT NULL,
    "suggestions" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "isAiAnalysis" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Analysis" ("company", "compatibilityScore", "createdAt", "cvFileName", "cvKeywords", "id", "jdKeywords", "jobDescription", "jobTitle", "matchedSkillsCount", "matchingSkills", "missingRequirements", "missingSkillsCount", "suggestions", "summary", "userId") SELECT "company", "compatibilityScore", "createdAt", "cvFileName", "cvKeywords", "id", "jdKeywords", "jobDescription", "jobTitle", "matchedSkillsCount", "matchingSkills", "missingRequirements", "missingSkillsCount", "suggestions", "summary", "userId" FROM "Analysis";
DROP TABLE "Analysis";
ALTER TABLE "new_Analysis" RENAME TO "Analysis";
CREATE INDEX "Analysis_userId_idx" ON "Analysis"("userId");
CREATE INDEX "Analysis_createdAt_idx" ON "Analysis"("createdAt");
CREATE TABLE "new_JobMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "summary" TEXT,
    "matchingSkills" TEXT,
    "missingRequirements" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "isAiAnalysis" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobMatch" ("createdAt", "id", "jobId", "matchingSkills", "missingRequirements", "notified", "score", "summary", "userId") SELECT "createdAt", "id", "jobId", "matchingSkills", "missingRequirements", "notified", "score", "summary", "userId" FROM "JobMatch";
DROP TABLE "JobMatch";
ALTER TABLE "new_JobMatch" RENAME TO "JobMatch";
CREATE INDEX "JobMatch_userId_idx" ON "JobMatch"("userId");
CREATE INDEX "JobMatch_jobId_idx" ON "JobMatch"("jobId");
CREATE INDEX "JobMatch_createdAt_idx" ON "JobMatch"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
