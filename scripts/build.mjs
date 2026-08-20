import { execFileSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const tsc = resolve(root, "node_modules/typescript/bin/tsc");

rmSync(dist, { recursive: true, force: true });
execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
});
copyFileSync(resolve(root, "src/liquid-tabs.css"), resolve(dist, "liquid-tabs.css"));
copyFileSync(resolve(root, "src/styles.d.ts"), resolve(dist, "styles.d.ts"));
