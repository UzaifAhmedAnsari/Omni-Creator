const rawApiBase = import.meta.env.VITE_API_URL ?? "/api";

export const apiBase = rawApiBase.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/api")
    ? path.slice(4)
    : path.startsWith("/")
      ? path
      : `/${path}`;

  return `${apiBase}${normalizedPath}`;
}

export function apiResourceUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const apiOrigin = apiBase.replace(/\/api$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiOrigin}${normalizedPath}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const maybeError = (body as Record<string, unknown>).error;

    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError;
    }

    const maybeMessage = (body as Record<string, unknown>).message;

    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  if (typeof body === "string" && body.trim()) {
    return body;
  }

  return fallback;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await readResponseBody(response).catch(() => undefined);
    throw new Error(getErrorMessage(body, `HTTP ${response.status}`));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await readResponseBody(response)) as T;
}

export function post<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patch<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function put<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function del<T = unknown>(path: string): Promise<T> {
  return apiRequest<T>(path, {
    method: "DELETE",
  });
}