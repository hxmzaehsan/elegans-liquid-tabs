import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowedRootEntries = new Set([
  ".github",
  ".gitignore",
  "LICENSE",
  "README.md",
  "examples",
  "package-lock.json",
  "package.json",
  "scripts",
  "src",
  "tsconfig.build.json",
  "tsconfig.json",
]);
const skippedDirectories = new Set([".git", "dist", "node_modules"]);
const skippedFiles = new Set([
  "scripts/verify-package.mjs",
  "scripts/verify-repository.mjs",
]);
const textExtensions = new Set([".css", ".js", ".json", ".md", ".mjs", ".ts", ".tsx", ".yml"]);
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
  ["GitHub token", /\bgh[opsu]_[A-Za-z0-9]{20,}\b/],
  ["npm token", /\bnpm_[A-Za-z0-9]{20,}\b/],
  ["API key", /\bsk-[A-Za-z0-9]{20,}\b/],
];
const errors = [];

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (skippedDirectories.has(entry.name)) continue;
  if (!allowedRootEntries.has(entry.name)) {
    errors.push(`Unexpected repository entry: ${entry.name}`);
  }
}

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolute);
      continue;
    }
    const path = relative(root, absolute);
    if (skippedFiles.has(path)) continue;
    if (!textExtensions.has(extname(path)) && path !== "LICENSE" && path !== ".gitignore") continue;
    const contents = readFileSync(absolute, "utf8");
    for (const [label, pattern] of forbidden) {
      if (pattern.test(contents)) errors.push(`${path} contains ${label}.`);
    }
    if (path.startsWith("src/") && /\bconsole\.(?:log|debug|warn|error)\b/.test(contents)) {
      errors.push(`${path} contains a console statement.`);
    }
  }
}

visit(root);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Repository contents are clean.");
}
