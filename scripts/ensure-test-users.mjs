/**
 * Creates the two accounts that tests/rls.integration.test.ts signs in as.
 *
 * The privacy proof needs two real, independent users, so this signs both of them
 * up through the same Better Auth endpoint the app's sign-up form uses. Already
 * existing accounts are left alone, so the script is safe to re-run.
 *
 *   npm run test:users
 */

const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const ORIGIN = process.env.APP_URL ?? "http://localhost:3000";

const USERS = [
  {
    label: "User A",
    email: process.env.TEST_USER_A_EMAIL,
    password: process.env.TEST_USER_A_PASSWORD,
    name: "RLS User A",
  },
  {
    label: "User B",
    email: process.env.TEST_USER_B_EMAIL,
    password: process.env.TEST_USER_B_PASSWORD,
    name: "RLS User B",
  },
];

if (!AUTH_URL || USERS.some((user) => !user.email || !user.password)) {
  console.error(
    "Needs NEXT_PUBLIC_NEON_AUTH_URL and TEST_USER_A/B_EMAIL and _PASSWORD in .env.local.",
  );
  process.exit(1);
}

for (const { label, email, password, name } of USERS) {
  const response = await fetch(`${AUTH_URL}/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password, name }),
  });

  const payload = await response.json().catch(() => null);

  if (response.ok) {
    console.log(`${label}: created ${email}`);
  } else if (
    response.status === 422 ||
    /exist/i.test(payload?.message ?? payload?.code ?? "")
  ) {
    console.log(`${label}: ${email} already exists, leaving it alone`);
  } else {
    console.error(`${label}: failed — ${response.status} ${JSON.stringify(payload)}`);
    process.exitCode = 1;
  }
}
