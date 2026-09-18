/**
 * Throwaway local Postgres for development and verification.
 *
 * This exists so the whole stack — schema, seed, menu page, order creation,
 * admin queue — can be exercised on a laptop without a Supabase account. It is
 * NOT how the app runs in production; production points DATABASE_URL at the
 * Supabase project (see README).
 *
 *   npm run db:up     start it on port 55432 and keep it running
 *   npm run db:reset  wipe the data directory and start clean
 *
 * The data lives in .devdb/ which is gitignored.
 */
import EmbeddedPostgres from "embedded-postgres";
import { rmSync, existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), ".devdb");
const PORT = 55432;
const USER = "rouveraki";
const PASSWORD = "rouveraki";
const DATABASE = "rouveraki";

const reset = process.argv.includes("--reset");

async function main() {
  if (reset && existsSync(DATA_DIR)) {
    console.log("Removing existing data directory...");
    rmSync(DATA_DIR, { recursive: true, force: true });
  }

  const fresh = !existsSync(DATA_DIR);

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (fresh) {
    console.log("Initialising a new cluster (first run downloads nothing extra)...");
    await pg.initialise();
  }

  await pg.start();

  if (fresh) {
    /**
     * The cluster inherits the Windows locale, which on a Greek machine gives a
     * WIN1252 template and silently mangles every Greek string. Create the
     * application database explicitly as UTF8 from template0 — Supabase is UTF8,
     * so this also keeps local and production behaviour identical.
     */
    const client = pg.getPgClient();
    await client.connect();
    await client.query(
      `CREATE DATABASE "${DATABASE}" WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    await client.end();
  }

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`;
  console.log(`\nPostgres is up.\n\n  DATABASE_URL="${url}"\n  DIRECT_URL="${url}"\n`);
  console.log("Leave this running. Ctrl+C to stop.\n");

  const stop = async () => {
    console.log("\nStopping Postgres...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  // Keep the process alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
