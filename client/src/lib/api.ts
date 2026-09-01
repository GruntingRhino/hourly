const API_BASE = "/api";
const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getResponseErrorMessage(body: unknown, fallback: string): string {
  return typeof body === "object" && body !== null && "error" in body
    ? String(body.error)
    : fallback;
}

function getTimeoutMs(): number {
  const envTimeout = import.meta.env.VITE_API_TIMEOUT_MS;
  const parsed = Number(envTimeout);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function fetchWithAuth(path: string, options?: RequestInit): Promise<Response> {
  const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = typeof window !== "undefined" ? window.localStorage.getItem("goodhours_token") : null;
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      // Auth now travels via the HttpOnly session cookie, sent
      // automatically for same-origin requests — explicit for clarity
      // since this is the mechanism the whole auth flow now depends on.
      credentials: "same-origin",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out", 0, { error: "Request timed out" });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  return res;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(path, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = getResponseErrorMessage(body, `Request failed: ${res.status}`);
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  if (res.headers.get("content-type")?.includes("text/csv")) {
    return (await res.text()) as unknown as T;
  }

  return res.json();
}

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const res = await fetchWithAuth(path, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = getResponseErrorMessage(body, `Request failed: ${res.status}`);
    throw new ApiError(message, res.status, body);
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body:
        typeof FormData !== "undefined" && body instanceof FormData
          ? body
          : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body:
        typeof FormData !== "undefined" && body instanceof FormData
          ? body
          : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body:
        typeof FormData !== "undefined" && body instanceof FormData
          ? body
          : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  download: (path: string) => requestBlob(path),
};
