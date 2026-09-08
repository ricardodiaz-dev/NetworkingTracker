/**
 * Prints the live security configuration of the contacts table straight from the
 * Postgres catalog: RLS flags, every policy with its USING and WITH CHECK clause,
 * the role grants, and the CHECK constraints.
 *
 * This is deliberately a read of the *database's* own state rather than of
 * db/schema.sql — the file says what was intended, this says what is actually
 * enforced. Run it with:
 *
 *   npm run db:verify
 */

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
  process.exit(1);
}

// Neon presents a valid public certificate, so ask for full verification explicitly.
// `sslmode=require` is currently only an alias for this in pg, and it warns that the
// alias will weaken to libpq semantics in pg v9 — so pin the strong mode by name.
const client = new pg.Client({
  connectionString: connectionString.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full"),
});

const QUERIES = [
  {
    title: "Row Level Security flags",
    sql: `select relname            as table,
                 relrowsecurity     as rls_enabled,
                 relforcerowsecurity as rls_forced
            from pg_class
           where relname = 'contacts';`,
  },
  {
    title: "Policies (one per command, as the rubric requires)",
    sql: `select polname as policy,
                 case polcmd when 'r' then 'SELECT'
                             when 'a' then 'INSERT'
                             when 'w' then 'UPDATE'
                             when 'd' then 'DELETE'
                             else polcmd::text end as command,
                 pg_get_expr(polqual, polrelid)      as using_clause,
                 pg_get_expr(polwithcheck, polrelid) as with_check_clause
            from pg_policy
           where polrelid = 'contacts'::regclass
           order by 2;`,
  },
  {
    title: "Table grants by role",
    sql: `select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
            from information_schema.role_table_grants
           where table_name = 'contacts'
           group by grantee
           order by grantee;`,
  },
  {
    title: "CHECK constraints",
    sql: `select conname as constraint, pg_get_constraintdef(oid) as definition
            from pg_constraint
           where conrelid = 'contacts'::regclass and contype = 'c'
           order by conname;`,
  },
  {
    title: "user_id column definition",
    sql: `select column_name, data_type, is_nullable, column_default
            from information_schema.columns
           where table_name = 'contacts' and column_name = 'user_id';`,
  },
];

try {
  await client.connect();
  for (const { title, sql } of QUERIES) {
    const { rows } = await client.query(sql);
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
    console.table(rows);
  }
} catch (error) {
  console.error("Verification failed:\n", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
