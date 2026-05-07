import { useEffect, useState, useRef } from "react"
import { userService } from "../../services/user.service"
import { 
  User, 
  Upload, 
  X, 
  Plus, 
  FileText, 
  Sparkles, 
  Briefcase, 
  CheckCircle2, 
  Loader2,
  Trash2,
  Edit2,
  Check,
  Camera
} from "lucide-react"
import { Button } from "../../components/ui/button"
import { toast } from "sonner"

interface UserProfile {
  name: string
  email: string
  cvFileName: string | null
  cvSummary: string | null
  cvKeywords: string[]
  cvUpdatedAt: string | null
  avatar: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [newSkill, setNewSkill] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const fetchProfile = async () => {
    try {
      const response = await userService.getProfile()
      setProfile(response.user)
      setEditedName(response.user.name)
    } catch (error) {
      toast.error("Failed to load profile")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateName = async () => {
    if (!profile || !editedName.trim() || editedName === profile.name) {
      setIsEditingName(false)
      setEditedName(profile?.name || "")
      return
    }

    setIsUpdatingName(true)
    try {
      await userService.updateProfile({ name: editedName.trim() })
      setProfile({ ...profile, name: editedName.trim() })
      toast.success("Name updated successfully")
      setIsEditingName(false)
    } catch (error) {
      toast.error("Failed to update name")
    } finally {
      setIsUpdatingName(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const toastId = toast.loading("Analyzing your CV...")
    
    try {
      await userService.uploadMasterCv(file)
      toast.success("Master CV indexed successfully!", { id: toastId })
      fetchProfile()
    } catch (error) {
      toast.error("Failed to upload CV", { id: toastId })
    } finally {
      setIsUploading(false)
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    const toastId = toast.loading("Updating profile picture...")
    
    try {
      const response = await userService.uploadAvatar(file)
      if (profile) {
        setProfile({ ...profile, avatar: response.avatar })
      }
      toast.success("Profile picture updated!", { id: toastId })
    } catch (error: any) {
      toast.error(error.message || "Failed to upload avatar", { id: toastId })
    } finally {
      setIsUploadingAvatar(false)
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  const handleDeleteSkill = async (skillToDelete: string) => {
    if (!profile) return
    const updatedKeywords = profile.cvKeywords.filter(k => k !== skillToDelete)
    try {
      await userService.updateKeywords(updatedKeywords)
      setProfile({ ...profile, cvKeywords: updatedKeywords })
      toast.success("Skill removed")
    } catch (error) {
      toast.error("Failed to update skills")
    }
  }

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newSkill.trim()) return
    if (profile.cvKeywords.includes(newSkill.trim())) {
      toast.error("Skill already exists")
      return
    }

    const updatedKeywords = [...profile.cvKeywords, newSkill.trim()]
    try {
      await userService.updateKeywords(updatedKeywords)
      setProfile({ ...profile, cvKeywords: updatedKeywords })
      setNewSkill("")
      toast.success("Skill added")
    } catch (error) {
      toast.error("Failed to update skills")
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Career Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your identity and resume to improve AI job matching
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Account & Resume */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div 
                className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary border-4 border-background shadow-xl overflow-hidden cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
              >
                {profile?.avatar ? (
                  <img 
                    src={profile.avatar} 
                    alt="Profile" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12" />
                )}
                
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-8 w-8 text-white" />
                </div>
                
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              
              <input
                type="file"
                ref={avatarInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={isUploadingAvatar}
              />
              <div className="mt-4 flex flex-col items-center">
                <div className="group relative flex items-center justify-center w-full">
                  {isEditingName ? (
                    <div className="flex flex-col items-center gap-2 w-full px-2">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-primary/30 bg-secondary/50 px-3 py-1.5 text-center text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-success hover:bg-success/10"
                          onClick={handleUpdateName}
                          disabled={isUpdatingName}
                        >
                          {isUpdatingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setIsEditingName(false)
                            setEditedName(profile?.name || "")
                          }}
                          disabled={isUpdatingName}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <h2 className="text-xl font-bold text-foreground">{profile?.name}</h2>
                      <button 
                        onClick={() => setIsEditingName(true)}
                        className="absolute -right-8 rounded-full p-1 text-muted-foreground opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
              <FileText className="h-4 w-4 text-primary" />
              Master Resume
            </h3>
            
            {profile?.cvFileName ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-sm font-medium text-foreground truncate">{profile.cvFileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last updated {new Date(profile.cvUpdatedAt!).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-3 w-3" />
                    Replace Resume
                  </Button>
                  <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>PDF only, max 5MB</span>
                  </div>
                </div>
              </div>
            ) : (
              <label className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 transition-colors hover:border-primary hover:bg-primary/5">
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={isUploading} />
                <div className="rounded-full bg-primary/10 p-3 group-hover:bg-primary/20">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">Upload Master CV</p>
                <p className="mt-1 text-xs text-muted-foreground">PDF only, max 10MB</p>
              </label>
            )}
          </div>
        </div>

        {/* Right Column: AI Insights & Skills */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-primary" />
              Professional Identity (AI Extracted)
            </h3>
            <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
              <p className="text-sm leading-relaxed text-foreground italic">
                "{profile?.cvSummary || "No summary yet. Upload your CV to enable AI profile generation."}"
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
                <Briefcase className="h-4 w-4 text-primary" />
                My Skills & Keywords
              </h3>
              <span className="text-xs text-muted-foreground">{profile?.cvKeywords.length || 0} skills</span>
            </div>

            <form onSubmit={handleAddSkill} className="mb-6 flex gap-2">
              <input
                type="text"
                placeholder="Add a skill (e.g. React, UX Design)"
                className="flex-1 rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
              />
              <Button type="submit" variant="default" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {profile?.cvKeywords.map((skill) => (
                <div 
                  key={skill}
                  className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
                >
                  {skill}
                  <button 
                    onClick={() => handleDeleteSkill(skill)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {profile?.cvKeywords.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No skills added yet. Upload a CV or add skills manually.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-success/20 bg-success/5 p-6">
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
              <div>
                <h4 className="font-bold text-foreground">Scraper Status: Active</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your profile is fully indexed. Our agents are monitoring <strong>Glorri.az</strong>, <strong>JobSearch.az</strong>, and <strong>Busy.az</strong> for jobs that match these skills.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
