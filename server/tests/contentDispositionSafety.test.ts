import test from "node:test";
import assert from "node:assert/strict";
import { create as contentDisposition } from "content-disposition";

test("a filename containing an embedded quote cannot break out of the Content-Disposition attribute", () => {
  const malicious = 'evil".pdf; filename="tricked.exe';
  const header = contentDisposition(malicious);
  // The raw string-interpolation form this replaces (`filename="${name}"`)
  // would have produced a header containing an unescaped `"` that closes
  // the filename attribute early, letting the rest of the attacker-supplied
  // string appear as if it were a second, sibling directive. The library
  // must escape embedded quotes/backslashes so the whole value stays inside
  // one filename attribute.
  assert.doesNotMatch(header, /filename="evil"\.pdf/);
  assert.match(header, /^attachment; filename="/);
});

test("a filename with non-ASCII characters is still encoded safely, not dropped or malformed", () => {
  const header = contentDisposition("résumé — 2026.pdf");
  assert.match(header, /^attachment; filename="/);
  // RFC 5987 extended parameter carries the accurate UTF-8 name for
  // browsers that support it, alongside the ASCII-fallback filename=.
  assert.match(header, /filename\*=UTF-8''/);
});

test("inline type is respected for attachment preview routes", () => {
  const header = contentDisposition("evidence.png", { type: "inline" });
  assert.match(header, /^inline; filename="?evidence\.png"?$/);
});
