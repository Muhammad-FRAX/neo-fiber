/**
 * Fetch wrapper that:
 * - Attaches Authorization: Bearer <token> from localStorage
 * - On 401: wipes the token and redirects to /login?next=<current_path>
 * - Returns typed JSON or throws ApiError
 *
 * T4 (FE half) — §9 auth spec, A4 decision
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const TOKEN_KEY = "nf_token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

function redirectToLogin(currentPath: string = window.location.pathname): never {
  clearToken()
  const next = encodeURIComponent(currentPath)
  window.location.href = `/login?next=${next}`
  // unreachable — satisfies return type
  throw new Error("redirecting to login")
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken()
  const { body, ...rest } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(path, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401) {
    redirectToLogin()
  }

  if (!response.ok) {
    let errorBody: { error?: { code?: string; message?: string; details?: unknown } } = {}
    try {
      errorBody = await response.json()
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      response.status,
      errorBody.error?.code ?? "INTERNAL",
      errorBody.error?.message ?? `Request failed: ${response.status}`,
      errorBody.error?.details,
    )
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
}
