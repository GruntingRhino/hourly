import { spawnSync } from "node:child_process";

const audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  cwd: new URL("..", import.meta.url),
});

if (audit.error) throw audit.error;

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error(audit.stderr || audit.stdout);
  throw new Error("npm audit did not return JSON");
}

const expectedTitle = "React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response";
const vulnerabilities = report.vulnerabilities ?? {};
const names = Object.keys(vulnerabilities).sort();
const knownFinding =
  names.length === 2 &&
  names[0] === "react-router" &&
  names[1] === "react-router-dom" &&
  vulnerabilities["react-router"]?.severity === "high" &&
  vulnerabilities["react-router"]?.via?.some((entry) => entry?.title === expectedTitle) &&
  vulnerabilities["react-router-dom"]?.severity === "high";

if (audit.status === 0) {
  console.log("Production dependency audit passed with no findings.");
  process.exit(0);
}

if (!knownFinding) {
  console.error(audit.stderr || audit.stdout);
  throw new Error("Production dependency audit contains an unexpected finding.");
}

console.log("Known React Router RSC-only advisory detected; applicability is checked by security:verify-no-rsc. See docs/qa/DEPENDENCY_ADVISORY_EXCEPTIONS.md.");
