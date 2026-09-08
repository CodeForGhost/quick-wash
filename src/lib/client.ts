"use client";

/** Shape every route handler returns (see `lib/api.ts`). */
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Calls the app's own API and unwraps the envelope, turning a failure into a
 * thrown Error carrying the server's message so forms can show it directly.
 */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(path, {
    ...rest,
    headers: json ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error("The server could not be reached. Please try again.");
  }

  if (!payload.ok) throw new Error(payload.error);
  return payload.data;
}

export function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
