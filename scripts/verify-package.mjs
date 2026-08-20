import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pack = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: root,
    encoding: "utf8",
  }),
)[0];
const files = pack.files.map(({ path }) => path).sort();
const allowedRootFiles = new Set(["LICENSE", "README.md", "package.json"]);
const requiredFiles = [
  "LICENSE",
  "README.md",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/liquid-tabs.css",
  "package.json",
];
const forbidden = [
  ["local computer path", /\/Users\//],
  ["local development URL", /(?:localhost|127\.0\.0\.1)/i],
  ["Notion reference", /\bNotion\b/i],
  ["developer reference", /developer reference/i],
  ["private Elegans repository", /hxmzaehsan\/elegans(?:\.git|["/]|$)/i],
  ["benchmark name", /\bJakub\b|Beautiful UI/i],
  ["unfinished note", /\bTODO\b|\bFIXME\b/],
  ["release-process note", /release candidate|unpublished/i],
  ["AI workbench reference", /\bCodex\b|\bClaude\b|\bCursor\b/],
];
const textExtensions = new Set([".css", ".js", ".json", ".md", ".ts"]);
const errors = [];

for (const path of files) {
  if (!path.startsWith("dist/") && !allowedRootFiles.has(path)) {
    errors.push(`Unexpected published file: ${path}`);
  }
}

for (const path of requiredFiles) {
  if (!files.includes(path)) errors.push(`Missing published file: ${path}`);
}

for (const path of files) {
  if (!textExtensions.has(extname(path)) && path !== "LICENSE") continue;
  const contents = readFileSync(resolve(root, path), "utf8");
  for (const [label, pattern] of forbidden) {
    if (pattern.test(contents)) errors.push(`${path} contains ${label}.`);
  }

  if (path.endsWith(".js") || path.endsWith(".d.ts")) {
    const relativeImports = contents.matchAll(
      /(?:from\s+|import\s*\(\s*)["'](\.[^"']+)["']/g,
    );
    for (const [, specifier] of relativeImports) {
      if (!/\.(?:css|js|json)$/.test(specifier)) {
        errors.push(`${path} contains an extensionless relative import: ${specifier}`);
        continue;
      }
      if (!existsSync(resolve(root, dirname(path), specifier))) {
        errors.push(`${path} imports a missing published file: ${specifier}`);
      }
    }
  }
}

const publicTypes = readFileSync(resolve(root, "dist/index.d.ts"), "utf8");
if (
  /\bdebug\b|\btrail\b|\bLiquidSession\b|\bLiquidFilter\b|\bLiquidMotionPreset\b|\bLiquidMovePhysics\b/.test(
    publicTypes,
  )
) {
  errors.push("The public types expose an internal engine control.");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Package contents are clean (${files.length} files).`);
}
