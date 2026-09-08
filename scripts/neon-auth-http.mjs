/**
 * Signs in to Neon Managed Better Auth over plain HTTP and returns the JWT that
 * the Neon Data API accepts.
 *
 * Two steps, and the second one is easy to miss:
 *
 *   1. POST /sign-in/email        → sets a `__Secure-neon-auth.session_token` cookie.
 *      The `token` in this response body is an OPAQUE SESSION TOKEN, not a JWT.
 *      Sending it to the Data API fails with "Provided authentication token is
 *      not a valid JWT encoding".
 *   2. GET /token (with that cookie) → `{ token: <JWT> }`. This one is signed,
 *      carries `role: authenticated`, and its `sub` claim is what `auth.user_id()`
 *      returns inside every RLS policy.
 *
 * In the browser the neon-js client does this exchange for you; scripts and tests
 * that talk to the auth service directly have to do it themselves.
 */

/** Better Auth refuses requests with no Origin, and Neon only allows configured ones. */
const DEFAULT_ORIGIN = process.env.APP_URL ?? "http://localhost:3000";

export async function signInForJwt(
  authUrl,
  email,
  password,
  origin = DEFAULT_ORIGIN,
) {
  const signIn = await fetch(`${authUrl}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password }),
  });

  if (!signIn.ok) {
    const detail = await signIn.text();
    throw new Error(`Sign-in failed for ${email}: ${signIn.status} ${detail}`);
  }

  const cookie = signIn
    .headers.getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  if (!cookie) {
    throw new Error(`No session cookie returned when signing in ${email}.`);
  }

  const exchange = await fetch(`${authUrl}/token`, {
    headers: { Cookie: cookie, Origin: origin },
  });

  const payload = await exchange.json().catch(() => null);
  const jwt = payload?.token;

  if (!exchange.ok || typeof jwt !== "string" || jwt.split(".").length !== 3) {
    throw new Error(
      `Could not exchange the session for a JWT for ${email}: ${exchange.status} ${JSON.stringify(payload)}`,
    );
  }

  return jwt;
}
