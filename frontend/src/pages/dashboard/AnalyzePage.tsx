import { DashboardHeader } from "../../components/DashboardHeader"
import { Button } from "../../components/ui/button"
import { cn } from "../../lib/utils"
import {
  Upload,
  FileText,
  X,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useState, useCallback, type DragEvent, type ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { analysisService } from "../../services/analysis.service"
import { toast } from "sonner"

export default function AnalyzePage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [jobDescription, setJobDescription] = useState("")
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile)
      simulateUpload()
    } else {
      toast.error("Only PDF files are accepted")
    }
  }, [])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      simulateUpload()
      e.target.value = ""
    }
  }

  const simulateUpload = () => {
    setUploadStatus("uploading")
    setTimeout(() => {
      setUploadStatus("success")
    }, 1500)
  }

  const removeFile = () => {
    setFile(null)
    setUploadStatus("idle")
  }

  const handleAnalyze = async () => {
    if (!file || !jobDescription.trim()) return

    setIsAnalyzing(true)

    try {
      const { analysis } = await analysisService.create(file, jobDescription)
      toast.success("Analysis complete!")
      navigate(`/dashboard/results/${analysis.id}`)
    } catch (error) {
      console.error("Analysis failed: ", error)
      toast.error(error instanceof Error ? error.message : "Analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const isReadyToAnalyze = file && jobDescription.trim() && uploadStatus === "success"

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Analyze CV"
        description="Upload your CV and paste a job description to get AI-powered analysis"
      />

      <div className="p-6">
        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {[
            { step: 1, label: "Upload CV", active: true },
            { step: 2, label: "Add Job", active: !!file },
            { step: 3, label: "Analyze", active: !!isReadyToAnalyze },
          ].map((item, index) => (
            <div key={item.step} className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    item.active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.step}
                </div>
                <span
                  className={cn(
                    "hidden text-sm font-medium sm:block",
                    item.active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </div>
              {index < 2 && (
                <div className="h-px w-8 bg-border sm:w-16" />
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* CV Upload Section */}
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Upload Your CV</h2>
              </div>

              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <p className="mb-2 text-center font-medium text-foreground">
                    Drag & drop your CV here
                  </p>
                  <p className="mb-4 text-center text-sm text-muted-foreground">
                    or click to browse (PDF only)
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Upload CV file"
                  />
                  <Button variant="outline" className="pointer-events-none">
                    Select File
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadStatus === "uploading" && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                      {uploadStatus === "success" && (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      )}
                      {uploadStatus === "error" && (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                      <button
                        onClick={removeFile}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Remove file"
                        tabIndex={0}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Secure upload - your data is encrypted</span>
              </div>
            </div>

            {/* Job Description Section */}
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Job Description</h2>
              </div>

              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder={`Paste the job description here...

Example:
We are looking for a Senior Software Engineer with 5+ years of experience in React, TypeScript, and Node.js. The ideal candidate should have strong problem-solving skills and experience with cloud services (AWS/GCP).`}
                className="min-h-70 w-full resize-none rounded-xl border border-border bg-secondary/30 p-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {jobDescription.length} characters
                </span>
                {jobDescription.length > 100 && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Good length
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Analyze Button */}
          <div className="mt-8 text-center">
            <Button
              size="lg"
              disabled={!isReadyToAnalyze || isAnalyzing}
              onClick={handleAnalyze}
              className="h-14 gap-3 bg-primary px-12 text-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze Now
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
            {!isReadyToAnalyze && (
              <p className="mt-4 text-sm text-muted-foreground">
                {!file
                  ? "Please upload your CV to continue"
                  : !jobDescription.trim()
                  ? "Please add a job description to continue"
                  : "Processing your file..."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
