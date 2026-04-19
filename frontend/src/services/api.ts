const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  isFormData?: boolean
}

const getTokens = () => ({
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: localStorage.getItem("refreshToken"),
})

const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem("accessToken", accessToken)
  localStorage.setItem("refreshToken", refreshToken)
}

export const clearTokens = () => {
  localStorage.removeItem("accessToken")
  localStorage.removeItem("refreshToken")
}

const refreshAccessToken = async (): Promise<string | null> => {
  const { refreshToken } = getTokens()
  if (!refreshToken) return null

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      clearTokens()
      return null
    }

    const data = await response.json()
    setTokens(data.accessToken, data.refreshToken)
    return data.accessToken
  } catch {
    clearTokens()
    return null
  }
}

export const api = async <T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> => {
  const { method = "GET", body, headers = {}, isFormData = false } = options
  const { accessToken } = getTokens()

  const requestHeaders: Record<string, string> = {
    ...headers,
  }

  if (accessToken) {
    requestHeaders["Authorization"] = `Bearer ${accessToken}`
  }

  if (!isFormData) {
    requestHeaders["Content-Type"] = "application/json"
  }

  let requestBody: BodyInit | undefined
  if (body) {
    requestBody = isFormData ? (body as FormData) : JSON.stringify(body)
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: requestBody,
  })

  // If 401, try refreshing the token
  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      requestHeaders["Authorization"] = `Bearer ${newToken}`
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: requestBody,
      })
    } else {
      clearTokens()
      window.location.href = "/login"
      throw new Error("Session expired")
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Request failed with status ${response.status}`)
  }

  return response.json()
}

export { setTokens }
