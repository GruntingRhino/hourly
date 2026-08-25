import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const serverRoot = path.resolve(__dirname, "..");

function listTypeScriptFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

test("every school-created beneficiary create delegates visibility-aware entitlement to the central policy", () => {
  const files = [
    ...listTypeScriptFiles(path.join(serverRoot, "src")),
    ...listTypeScriptFiles(path.join(serverRoot, "prisma")).filter((file) => !file.includes(`${path.sep}migrations${path.sep}`)),
  ];
  const schoolCreateSites: Array<{ file: string; line: number }> = [];
  const ordinaryCreateSites: Array<{ file: string; line: number }> = [];

  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === "create"
        && ts.isPropertyAccessExpression(node.expression.expression)
        && node.expression.expression.name.text === "beneficiary"
      ) {
        const callText = node.getText(source);
        if (callText.includes("createdBySchoolId")) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          schoolCreateSites.push({ file: path.relative(serverRoot, file), line });
          assert.match(
            callText,
            /schoolCreatedBeneficiaryPlan\(/,
            `${path.relative(serverRoot, file)}:${line} bypasses the centralized school entitlement policy`,
          );
        } else {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          ordinaryCreateSites.push({ file: path.relative(serverRoot, file), line });
          assert.doesNotMatch(
            callText,
            /planTier\s*:\s*["']PRO["']/,
            `${path.relative(serverRoot, file)}:${line} grants free Pro to an ordinary organization`,
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  assert.equal(schoolCreateSites.length, 9, `expected 9 audited creation sites, found ${JSON.stringify(schoolCreateSites)}`);
  assert.ok(ordinaryCreateSites.length > 0, "expected to audit ordinary beneficiary creation sites");
});

test("the forward repair grants Pro only to private school-created beneficiaries", () => {
  const sql = fs.readFileSync(
    path.join(serverRoot, "prisma/migrations/20260726203000_restore_school_private_permanent_pro/migration.sql"),
    "utf8",
  );
  assert.match(sql, /"createdBySchoolId" IS NOT NULL/);
  assert.match(sql, /"visibility"\s*=\s*'PRIVATE'/);
  assert.match(sql, /"hasSchoolComplimentaryPro"\s*=\s*true/);
  assert.match(sql, /SET "planTier" = 'PRO'/);
  assert.doesNotMatch(sql, /"visibility" = 'PUBLIC'/);
});
