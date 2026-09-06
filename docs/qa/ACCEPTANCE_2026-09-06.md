{
  "date": "2026-09-06",
  "checkout": "/home/opc/RTB/projects/goodhours",
  "branch": "terra/fix-sol-findings-20260826",
  "head": "9c32bb6a84c9ac6f5e115e8e7bc250b2cdef03f2",
  "runtime": {"node": "v24.20.0", "npm": "11.19.0", "chromium": "chromium-1208"},
  "files": {
    "client/src/pages/Login.tsx": "574d69417718671b5b25e2af776b8e69bef7d11b699260f06c213937b1b353d8",
    "client/src/pages/Signup.tsx": "6cd48227749c20f25c3f9366859d565a7adafc515e4243a082d3e307a869232c",
    "client/src/pages/Privacy.tsx": "9f09bddc7d7c4f072e7e3f8fd68e0f73bc20f798e5012af439d9edf378a31b4f",
    "client/src/pages/Terms.tsx": "d0e9e3fa820a603ee3984ff20a0b0bd9f5dc489b77f9d9257f7f14aeab9b40da",
    "client/src/pages/FAQ.tsx": "ca8a7b6754ccc665a07e5a9cf2f859c7347f8317d5c5c36d74db9cd88ab4c116",
    "tests/accessibility.spec.ts": "e10e489bf4f235a936a2adf88fd45537e61ca99b2518d2a1060f40a50183180a",
    "tests/onboarding-browser-verification.spec.ts": "98ac4136dc33de8c195adcf2be04dbabbffa8289abd5d119f7b7f60af034f74e",
    "server/tests/cancelledBeneficiaryExport.test.ts": "082f20fca03bb8bda37c90c0de29e794241b67dcb10ad7c49a4835a5eb06b3b6",
    "server/tests/canonicalEventTimeModel.test.ts": "9fdbb140c1e0f6d2b4f0b0d8f2a6f8b09d41406d2c04d7095565a0e40897615e"
  },
  "evidence": {
    "server_suite": "464 total / 464 pass / 0 fail / 0 skipped (canonical rerun with RATE_LIMIT_TEST_DATABASE_URL enabled)",
    "focused": "7 pass / 0 fail / 0 skipped",
    "browser_public_axe": "6 routes, 0 critical, 0 serious, 0 page exceptions",
    "browser_onboarding": "2 pass / 0 fail",
    "browser_accessibility": "6 pass / 0 fail",
    "audits": "root/server/client: 0 vulnerabilities each",
    "api_health": "200 db ok",
    "live_schema_diff": "empty migration",
    "git_diff_check": "pass"
  },
  "limitations": [
    "Google URL endpoint returned 503 because provider credentials/configuration are absent; no provider success claim.",
    "Intercepted onboarding responses prove UI gating only, not persistence/provider behavior.",
    "No deployment or production data/action performed; legal/provider/operational/manual gates remain external."
  ]
}
