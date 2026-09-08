import { createClient } from "@neondatabase/neon-js";

const dataApiUrl = process.env.NEON_DATA_API_URL;

/**
 * Reads the caller's bearer token. The route handler does not verify the JWT itself —
 * it forwards the token to the Neon Data API, which validates the signature, maps the
 * request to the `authenticated` Postgres role and populates auth.user_id(). A forged
 * or expired token therefore fails at Neon, and RLS decides which rows are visible.
 */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}

/**
 * A Data API client acting as the signed-in user. Deliberately has no `auth` section
 * and no service key, so there is no code path here that can bypass RLS.
 */
export function dataApiForToken(token: string) {
  if (!dataApiUrl) {
    throw new Error(
      "Missing NEON_DATA_API_URL. Copy .env.example to .env.local and fill in the value from the Neon Console.",
    );
  }

  return createClient({
    dataApi: {
      url: dataApiUrl,
      getToken: async () => token,
    },
  });
}

export function unauthorized() {
  return Response.json(
    { error: "You must be signed in to do that." },
    { status: 401 },
  );
}

export function validationFailed(fields: Record<string, string>) {
  return Response.json(
    { error: "Please correct the highlighted fields.", fields },
    { status: 400 },
  );
}

/**
 * Postgres error codes surface real validation failures (a CHECK constraint firing is a
 * genuine 400, not a server fault), so they are mapped rather than blanket-500'd.
 */
export function databaseError(error: { code?: string; message?: string } | null) {
  if (error?.code === "23514") {
    return Response.json(
      { error: "That contact failed a database validation rule." },
      { status: 400 },
    );
  }

  if (error?.code === "42501") {
    return Response.json(
      { error: "You do not have permission to modify that contact." },
      { status: 403 },
    );
  }

  console.error("Neon Data API error:", error);
  return Response.json(
    { error: "Something went wrong talking to the database. Please try again." },
    { status: 500 },
  );
}
