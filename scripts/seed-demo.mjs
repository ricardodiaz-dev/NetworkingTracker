/**
 * Development utility: signs in as TEST_USER_A and creates a handful of contacts
 * through the app's own /api/contacts route, so the list, sort, filter, and search
 * controls have something realistic to work against.
 *
 * Goes through the Next.js API rather than straight to the Data API on purpose —
 * it exercises the same validation path the browser uses.
 *
 *   npm run dev            # in one terminal
 *   npm run seed:demo      # in another
 */

import { signInForJwt } from "./neon-auth-http.mjs";

const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_USER_A_EMAIL;
const PASSWORD = process.env.TEST_USER_A_PASSWORD;

if (!AUTH_URL || !EMAIL || !PASSWORD) {
  console.error(
    "Needs NEXT_PUBLIC_NEON_AUTH_URL, TEST_USER_A_EMAIL and TEST_USER_A_PASSWORD in .env.local.",
  );
  process.exit(1);
}

const CONTACTS = [
  {
    name: "Grace Hopper",
    company: "Naval Research",
    role: "Rear Admiral",
    met_at: "Systems seminar",
    notes: "Offered to review the compiler chapter.",
    priority: "high",
  },
  {
    name: "Alan Turing",
    company: "Bletchley Labs",
    role: "Research Lead",
    met_at: "Cryptography reading group",
    notes: "Wants to co-author a paper on decidability.",
    priority: "medium",
  },
  {
    name: "Katherine Johnson",
    company: "NASA Langley",
    role: "Aerospace Technologist",
    met_at: "Alumni mixer",
    notes: "Introduced me to two people on the trajectory team.",
    priority: "low",
  },
  {
    name: "Barbara Liskov",
    company: "MIT CSAIL",
    role: "Professor",
    met_at: "Distributed systems talk",
    notes: "Suggested reading her replication papers before we speak again.",
    priority: "high",
  },
];

const token = await signInForJwt(AUTH_URL, EMAIL, PASSWORD, APP_URL);

for (const contact of CONTACTS) {
  const response = await fetch(`${APP_URL}/api/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(contact),
  });

  const body = await response.json().catch(() => null);
  console.log(
    `${response.status} ${contact.name}${response.ok ? "" : ` — ${JSON.stringify(body)}`}`,
  );
}
