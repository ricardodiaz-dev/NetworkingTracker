"use client";

import { createClient } from "@neondatabase/neon-js";

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

if (!authUrl || !dataApiUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_NEON_AUTH_URL or NEXT_PUBLIC_NEON_DATA_API_URL. Copy .env.example to .env.local and fill in the values from the Neon Console.",
  );
}

/**
 * Browser client. Only ever used for auth — contact reads and writes go through
 * /api/contacts so that validation runs on the server. Both URLs are public by design;
 * RLS on the contacts table is what actually protects the data.
 */
export const neon = createClient({
  auth: { url: authUrl },
  dataApi: { url: dataApiUrl },
});

/**
 * The bearer token the API routes forward to the Neon Data API. Returns null when
 * signed out, which the UI treats as "redirect to /sign-in".
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await neon.auth.getSession();
  return data?.session?.token ?? null;
}

/** Wrapper around fetch that attaches the session token and normalises API errors. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.error ?? `Request failed with status ${response.status}.`,
    ) as Error & { fields?: Record<string, string> };
    error.fields = payload?.fields;
    throw error;
  }

  return payload as T;
}
