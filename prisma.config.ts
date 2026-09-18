import path from "node:path";
import { defineConfig } from "prisma/config";

// A prisma.config.ts file disables Prisma's implicit .env loading, so load it
// here explicitly — otherwise `prisma db push` cannot see DATABASE_URL.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
