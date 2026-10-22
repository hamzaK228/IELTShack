#!/usr/bin/env node
/** Runs the release gate: content validation, typecheck, production build. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const steps = [
  ["Content validation", "node", ["scripts/validate-content.mjs"]],
  ["Typecheck", "npx", ["tsc", "--noEmit"]],
  ["Production build", "npm", ["run", "build"]],
];

if (!existsSync(".env.local") && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("⚠ No .env.local and no NEXT_PUBLIC_SUPABASE_URL — build will use demo mode.");
}

for (const [name, command, args] of steps) {
  console.log(`\n▸ ${name}`);
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`\n✗ ${name} failed.`);
    process.exit(result.status ?? 1);
  }
}
console.log("\n✓ Release checks passed.");
