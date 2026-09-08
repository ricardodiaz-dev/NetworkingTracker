import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Plain-JS helper, shared with scripts/ so the sign-in flow has exactly one implementation.
import { signInForJwt } from "../scripts/neon-auth-http.mjs";

/**
 * Two-account privacy proof, run against the live Neon Data API over plain HTTP.
 *
 * Deliberately bypasses the Next.js API layer: if this passes, ownership is being
 * enforced by Row Level Security in Postgres, not by application code that a determined
 * caller could simply skip.
 *
 * Skipped automatically unless the TEST_USER_* and NEON URL variables are set — see
 * .env.example. Create both accounts through the app's own sign-up form first.
 */

const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const DATA_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
const A_EMAIL = process.env.TEST_USER_A_EMAIL;
const A_PASSWORD = process.env.TEST_USER_A_PASSWORD;
const B_EMAIL = process.env.TEST_USER_B_EMAIL;
const B_PASSWORD = process.env.TEST_USER_B_PASSWORD;

const configured = Boolean(
  AUTH_URL && DATA_URL && A_EMAIL && A_PASSWORD && B_EMAIL && B_PASSWORD,
);

/** An origin the Neon Console allows for both Better Auth and the Data API. */
const ORIGIN = process.env.APP_URL ?? "http://localhost:3000";

function signIn(email: string, password: string): Promise<string> {
  return signInForJwt(AUTH_URL!, email, password, ORIGIN);
}

function dataApi(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${DATA_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
      ...init.headers,
    },
  });
}

describe.skipIf(!configured)("Row Level Security ownership", () => {
  let tokenA = "";
  let tokenB = "";
  let contactIdA = "";

  beforeAll(async () => {
    tokenA = await signIn(A_EMAIL!, A_PASSWORD!);
    tokenB = await signIn(B_EMAIL!, B_PASSWORD!);

    const response = await dataApi(tokenA, "/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: `RLS probe ${Date.now()}`,
        priority: "high",
      }),
    });

    const [created] = await response.json();
    expect(response.ok).toBe(true);
    contactIdA = created.id;
  });

  // The probe row is real data in a real database, so clean it up rather than
  // leaving a trail of test fixtures in User A's contact list.
  afterAll(async () => {
    if (!contactIdA || !tokenA) return;
    await dataApi(tokenA, `/contacts?id=eq.${contactIdA}`, { method: "DELETE" });
  });

  it("stamps the row with the creating user, not a client-supplied value", async () => {
    const response = await dataApi(tokenA, `/contacts?id=eq.${contactIdA}`);
    const [row] = await response.json();

    expect(row.user_id).toBeTruthy();
  });

  it("User A can read their own contact", async () => {
    const response = await dataApi(tokenA, `/contacts?id=eq.${contactIdA}`);
    const rows = await response.json();

    expect(rows).toHaveLength(1);
  });

  it("User B cannot read User A's contact", async () => {
    const response = await dataApi(tokenB, `/contacts?id=eq.${contactIdA}`);
    const rows = await response.json();

    expect(rows).toHaveLength(0);
  });

  it("User B cannot update User A's contact", async () => {
    const response = await dataApi(tokenB, `/contacts?id=eq.${contactIdA}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Hijacked by User B" }),
    });
    const rows = await response.json();

    expect(rows).toHaveLength(0);

    // and the row is genuinely untouched
    const check = await dataApi(tokenA, `/contacts?id=eq.${contactIdA}`);
    const [row] = await check.json();
    expect(row.name).not.toBe("Hijacked by User B");
  });

  it("User B cannot delete User A's contact", async () => {
    const response = await dataApi(tokenB, `/contacts?id=eq.${contactIdA}`, {
      method: "DELETE",
    });
    const rows = await response.json();

    expect(rows).toHaveLength(0);

    const check = await dataApi(tokenA, `/contacts?id=eq.${contactIdA}`);
    expect(await check.json()).toHaveLength(1);
  });

  it("User A cannot reassign their row to User B", async () => {
    const response = await dataApi(tokenA, `/contacts?id=eq.${contactIdA}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: "some-other-user-id" }),
    });

    // The UPDATE policy's WITH CHECK rejects the new row outright.
    expect(response.ok).toBe(false);
  });

  it("an anonymous request is rejected outright, not merely filtered", async () => {
    const response = await fetch(`${DATA_URL}/contacts`);
    const body = await response.json().catch(() => null);

    // Asserting the rejection, not just an empty array: a test that only checked
    // for zero rows would also pass if the endpoint 200'd with [], which would
    // hide a misconfigured `anonymous` grant.
    expect(response.ok).toBe(false);
    expect(body?.message).toMatch(/authentication credentials/i);
    expect(Array.isArray(body)).toBe(false);
  });
});
