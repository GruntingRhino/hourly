import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(clientDir, "src");
const packageLock = JSON.parse(await readFile(path.join(clientDir, "package-lock.json"), "utf8"));
const forbiddenPackages = [
  "node_modules/react-server-dom-webpack",
  "node_modules/@react-router/dev",
];
const forbiddenImports = [
  "react-router-dom/server",
  "react-router/dom",
  "react-server-dom",
  "HydratedRouter",
  "RouterProvider",
  "ServerRouter",
];

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(dir, entry.name);
    return entry.isDirectory()
      ? sourceFiles(entryPath)
      : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
        ? [entryPath]
        : [];
  }));
  return files.flat();
}

const violations = forbiddenPackages
  .filter((packagePath) => packageLock.packages?.[packagePath])
  .map((packagePath) => `Forbidden RSC package is installed: ${packagePath}`);

for (const file of await sourceFiles(sourceDir)) {
  const content = await readFile(file, "utf8");
  for (const forbiddenImport of forbiddenImports) {
    if (content.includes(forbiddenImport)) {
      violations.push(`Forbidden RSC API reference in ${path.relative(clientDir, file)}: ${forbiddenImport}`);
    }
  }
}

const app = await readFile(path.join(sourceDir, "App.tsx"), "utf8");
if (!app.includes("<BrowserRouter>")) {
  violations.push("The client must use BrowserRouter rather than an RSC router.");
}

if (violations.length) {
  console.error("RSC exposure check failed:\n" + violations.map((violation) => `- ${violation}`).join("\n"));
  process.exit(1);
}

console.log("RSC exposure check passed: GoodHours is a BrowserRouter SPA with no RSC runtime or APIs.");
