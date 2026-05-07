import { api } from "./api"

export interface UserProfileResponse {
  user: {
    id: string
    name: string
    email: string
    avatar: string | null
    cvFileName: string | null
    cvKeywords: string[]
    cvSummary: string | null
    cvUpdatedAt: string | null
    lastManualSyncAt: string | null
    createdAt: string
  }
}

export const userService = {
  getProfile: async (): Promise<UserProfileResponse> => {
    return api<UserProfileResponse>("/api/user/profile")
  },

  uploadMasterCv: async (file: File): Promise<{ message: string; profile: any }> => {
    const formData = new FormData()
    formData.append("cv", file)
    return api<{ message: string; profile: any }>("/api/user/cv", {
      method: "POST",
      body: formData,
      isFormData: true
    })
  },

  updateKeywords: async (keywords: string[]): Promise<{ message: string }> => {
    return api<{ message: string }>("/api/user/keywords", {
      method: "PUT",
      body: { keywords }
    })
  },

  updateProfile: async (data: { name: string }): Promise<{ message: string; user: any }> => {
    return api<{ message: string; user: any }>("/api/user/profile", {
      method: "PUT",
      body: data
    })
  },

  uploadAvatar: async (file: File): Promise<{ message: string; avatar: string }> => {
    const formData = new FormData()
    formData.append("avatar", file)

    return api<{ message: string; avatar: string }>("/api/user/avatar", {
      method: "POST",
      body: formData,
      isFormData: true
    })
  }
}
