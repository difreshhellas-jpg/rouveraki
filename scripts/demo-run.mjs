// Runs a package script with demo mode on, on any OS:  node scripts/demo-run.mjs dev|build|start
import { spawnSync } from "node:child_process";

const script = process.argv[2] ?? "dev";
const r = spawnSync("npm", ["run", script], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "true" },
});
process.exit(r.status ?? 1);
