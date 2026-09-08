/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 * Exists so that setting up this project needs nothing but Node — `psql` is not
 * required. Run it with:
 *
 *   npm run db:push
 *
 * The schema is written to be idempotent, so re-running it is safe.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const schemaPath = fileURLToPath(new URL("../db/schema.sql", import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
  process.exit(1);
}

const sql = await readFile(schemaPath, "utf8");
// Neon presents a valid public certificate, so ask for full verification explicitly.
// `sslmode=require` is currently only an alias for this in pg, and it warns that the
// alias will weaken to libpq semantics in pg v9 — so pin the strong mode by name.
const client = new pg.Client({
  connectionString: connectionString.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full"),
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied ${schemaPath.split("/").pop()} successfully.`);
} catch (error) {
  console.error("Failed to apply schema:\n", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
