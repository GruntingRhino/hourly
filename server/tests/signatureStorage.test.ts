import test from "node:test";
import assert from "node:assert/strict";
import { detectSignatureMime } from "../src/lib/signatureStorage";

test("signature content validation accepts only PDF PNG and JPEG magic bytes", () => {
  assert.equal(detectSignatureMime(Buffer.from("%PDF-1.7\n")), "application/pdf");
  assert.equal(detectSignatureMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectSignatureMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
});

test("signature content validation rejects spoofed extensions and unsupported bytes", () => {
  assert.equal(detectSignatureMime(Buffer.from("not actually a pdf")), null);
  assert.equal(detectSignatureMime(Buffer.from([0x47, 0x49, 0x46, 0x38])), null);
});
