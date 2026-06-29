# GoodHours Accessibility Audit Report

**Date:** 2026-06-29  
**Standard:** WCAG 2.1 AA  
**Tool:** @axe-core/playwright 4.12 + Playwright manual assertions  
**Environment:** Chromium headless, localhost:5173 (Vite dev server) + localhost:3001 (Express API)

---

## 1. Methodology

### Automated (axe-core)
Every page was loaded in Chromium, brought to a network-idle state, then analyzed with `AxeBuilder.withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"])`. Violations are categorized by axe impact level:

| Impact | Definition | Gate |
|--------|-----------|------|
| **Critical** | Blocks access for users with disabilities | FAIL |
| **Serious** | Very difficult to work around | FAIL |
| Moderate | Difficult to work around for some users | WARNING |
| Minor | Low-impact | WARNING |

**Pass/fail gate:** A page **FAILS** if it has any critical or serious violations.

### Manual (Playwright assertions)
- Tab-order through the login form
- Empty-form submission error feedback
- Global CSS outline suppression detection
- `<img>` elements without `alt` attributes
- `<button>` elements without accessible names

---

## 2. Results Per Page

### 2.1 Landing Page (`/`)
**Overall verdict: FAIL**

| Rule | Impact | Nodes | WCAG Criterion |
|------|--------|-------|----------------|
| `color-contrast` | Serious | 59 | 1.4.3 Contrast (Minimum) |

The `--text-faint` CSS variable resolves to **#908a83**. Against the app's warm-gray page background (`--bg: #f2f0ec`) this yields a contrast ratio of **3.0:1**, and against card surfaces (`--surface: #ffffff`) **3.41:1**. Both fall below the 4.5:1 AA threshold for normal text.

Affected elements include: hero caption text, stat card labels ("Total Students", "Total Hours", "Goal Reached", "At Risk"), and preview thumbnails at small font sizes (8-12px).

---

### 2.2 Login Page (`/login`)
**Overall verdict: FAIL**

| Rule | Impact | Nodes | WCAG Criterion |
|------|--------|-------|----------------|
| `button-name` | Critical | 1 | 4.1.2 Name, Role, Value |
| `label` | Critical | 1 | 1.3.1 Info and Relationships / 4.1.2 |
| `color-contrast` | Serious | 1 | 1.4.3 Contrast (Minimum) |

**button-name:** The password-visibility toggle (`<button type="button" class="absolute right-2.5 ...">`) has `tabindex="-1"` but still appears in the accessibility tree with no `aria-label`, `aria-labelledby`, or visible text. Screen readers announce it as an unnamed button.

**label:** The password `<input type="password">` has no associated `<label>`, no `aria-label`, and no `aria-labelledby`. It is identified only by placeholder styling.

**color-contrast:** Helper/hint text below the form uses `--text-faint` on white — 3.41:1 actual vs 4.5:1 required.

#### Manual keyboard findings
**FAIL — Tab order:** After page load, pressing Tab once does **not** focus the email input. A focusable element above the form (logo link or navigation anchor) captures focus first. Users must tab through one or more unexpected stops before reaching the email field.

**PASS — Empty-form error messages:** Submitting with blank fields surfaces a visible error message containing the word "email" or "password".

**PASS — Focus outline:** No global `outline: none` suppression found in loaded stylesheets.

---

### 2.3 Student Dashboard (`/dashboard` as john@student.edu)
**Overall verdict: FAIL**

| Rule | Impact | Nodes | WCAG Criterion |
|------|--------|-------|----------------|
| `color-contrast` | Serious | 28 | 1.4.3 Contrast (Minimum) |

Widespread use of `--text-faint` (#908a83) for secondary labels, breadcrumbs ("Student / Dashboard"), stat card captions (scaled at 72% rendering: effective ~8-9px font), and status badges. At 8-9px, even a 3.0:1 ratio is especially problematic as WCAG requires 4.5:1 for text under 18pt regular or 14pt bold.

---

### 2.4 Student Browse Page (`/browse` as john@student.edu)
**Overall verdict: FAIL**

| Rule | Impact | Nodes | WCAG Criterion |
|------|--------|-------|----------------|
| `color-contrast` | Serious | 6 | 1.4.3 Contrast (Minimum) |

Affected elements:
- Breadcrumb label "Student / Browse" — #908a83 on #f2f0ec = 3.0:1
- Inactive view-toggle button ("▦ Calendar") — #908a83 on #f7f5f1 = 3.13:1  
- Slot card secondary text ("spots") — #908a83 on #ffffff = 3.41:1 (appears on every opportunity card)

---

### 2.5 Opportunity Detail Page
**Overall verdict: N/A (skipped)**

The Browse page rendered zero `[href*="/opportunity/"]` links at test time (slots link to `/slot/:id`). The test gracefully skipped navigation. A future test run should target `/slot/:id` links directly.

---

### 2.6 Org Dashboard (`/dashboard` as volunteer@greenearth.org)
**Overall verdict: FAIL**

| Rule | Impact | Nodes | WCAG Criterion |
|------|--------|-------|----------------|
| `color-contrast` | Serious | 4 | 1.4.3 Contrast (Minimum) |

Affected elements:
- **Notification badge count:** white (#ffffff) text on red-500 (#fb2c36) at 10px — ratio **3.8:1** (needs 4.5:1 at that size)
- Dashboard stat subtitles ("awaiting your review", "pending response") — #908a83 on #ffffff = 3.41:1

---

### 2.7 School Admin Dashboard (`/dashboard` as admin@lincoln.edu)
**Overall verdict: FAIL**

| Rule | Impact | Nodes | WCAG Criterion |
|------|--------|-------|----------------|
| `color-contrast` | Serious | 34 | 1.4.3 Contrast (Minimum) |
| `link-in-text-block` | Serious | varies | 1.4.1 Use of Color |

**link-in-text-block:** One or more inline links within body text are distinguished only by color (no underline, no other non-color differentiator). Users with color blindness cannot identify them as links.

The school dashboard has the highest violation count (34 nodes) because it displays dense data tables and student lists that heavily use `--text-faint` for secondary columns.

---

### 2.8 School Student List (`/students` as admin@lincoln.edu)
**Overall verdict: FAIL**

| Rule | Impact | Nodes | WCAG Criterion |
|------|--------|-------|----------------|
| `color-contrast` | Serious | 6 | 1.4.3 Contrast (Minimum) |

Table cells using `text-[var(--text-faint)]` for hour totals and status text ("No case") fail contrast. At 14px regular text the threshold is 4.5:1; observed ratio is 3.0:1.

---

## 3. Manual Checks — Landing Page
**Images alt text: PASS** — All `<img>` elements on the landing page carry an `alt` attribute.

**Buttons accessible names: PASS** — No icon-only buttons without accessible names were found on the landing page.

---

## 4. Summary Table

| Page | Critical | Serious | Moderate | Minor | Verdict |
|------|----------|---------|----------|-------|---------|
| Landing | 0 | 1 (`color-contrast`, 59 nodes) | 0 | 0 | **FAIL** |
| Login | 2 (`button-name`, `label`) | 1 (`color-contrast`) | 0 | 0 | **FAIL** |
| Login — keyboard nav | — | — | — | — | **FAIL** |
| Login — images/buttons | — | — | — | — | PASS |
| Student Dashboard | 0 | 1 (`color-contrast`, 28 nodes) | 0 | 0 | **FAIL** |
| Student Browse | 0 | 1 (`color-contrast`, 6 nodes) | 0 | 0 | **FAIL** |
| Opportunity Detail | — | — | — | — | N/A (skipped) |
| Org Dashboard | 0 | 1 (`color-contrast`, 4 nodes) | 0 | 0 | **FAIL** |
| School Dashboard | 0 | 2 (`color-contrast`×34, `link-in-text-block`) | 0 | 0 | **FAIL** |
| School Student List | 0 | 1 (`color-contrast`, 6 nodes) | 0 | 0 | **FAIL** |

**Overall: 0 pages pass / 7 pages fail / 1 page N/A**

---

## 5. Violations — Remediation Guide

### V-01: `color-contrast` — `--text-faint` on warm-gray backgrounds
**WCAG:** 1.4.3 (AA)  
**Impact:** Serious  
**Pages:** All pages  

The root cause is a single design token: `--text-faint: #908a83`. This color is used for secondary/helper text throughout the app.

| Foreground | Background | Current ratio | Required | Gap |
|------------|-----------|---------------|----------|-----|
| #908a83 | #f2f0ec (`--bg`) | 3.0:1 | 4.5:1 | -1.5 |
| #908a83 | #f7f5f1 (`--surface-alt`) | 3.13:1 | 4.5:1 | -1.37 |
| #908a83 | #ffffff (`--surface`) | 3.41:1 | 4.5:1 | -1.09 |

**Remediation:** Darken `--text-faint` to approximately **#6b6560** (estimated ratio ~4.6:1 on white) or restrict its use to non-text decorative elements. Run the updated token through a contrast checker against all three background values before deploying.

---

### V-02: `button-name` — Password visibility toggle
**WCAG:** 4.1.2 (A)  
**Impact:** Critical  
**Page:** Login  

The `<button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 ...">` has no accessible name.

**Remediation:** Add `aria-label="Toggle password visibility"` (or `aria-label="Show password"` / `"Hide password"` toggled dynamically with state):
```tsx
<button
  type="button"
  aria-label={showPassword ? "Hide password" : "Show password"}
  tabIndex={-1}
  ...
>
```

---

### V-03: `label` — Password input unlabeled
**WCAG:** 1.3.1, 4.1.2 (A)  
**Impact:** Critical  
**Page:** Login  

The password `<input type="password">` lacks a programmatic label.

**Remediation:** Wrap with `<label>` or add `aria-label`:
```tsx
<label htmlFor="password" className="sr-only">Password</label>
<input id="password" type="password" ... />
```

---

### V-04: `link-in-text-block` — Color-only link differentiation
**WCAG:** 1.4.1 (A)  
**Impact:** Serious  
**Page:** School Dashboard  

Inline links within body text lack underlines or other non-color distinguishers.

**Remediation:** Add `text-decoration: underline` to inline links, or use a visual indicator (underline on hover + border-bottom on default state). Do not rely on color alone.

---

### V-05: Tab order — Login form
**WCAG:** 2.1.1 (A), 2.4.3 (A)  
**Impact:** Serious (manual finding)  
**Page:** Login  

First Tab keypress from a freshly loaded login page does not focus the email input; a focusable element before the form (likely the logo `<a>` or a nav link) takes focus first. While not technically wrong if the focus order follows DOM order, it degrades keyboard UX when the page's sole purpose is the login form.

**Remediation:** Options in order of preference:
1. Add a visually-hidden skip link `<a href="#email" className="sr-only focus:not-sr-only">Skip to login form</a>` at the top of `<body>`.
2. Auto-focus the email input on mount: `<input autoFocus type="email" ... />`.
3. Reorder DOM so the form precedes nav elements.

---

### V-06: Notification badge contrast
**WCAG:** 1.4.3 (AA)  
**Impact:** Serious  
**Page:** Org Dashboard  

White text on `bg-red-500` (#fb2c36) at 10px = 3.8:1. Required for 10px text is 4.5:1.

**Remediation:** Switch to `bg-red-700` (#b91c1c) which yields ~6.0:1 against white, or increase font size to 14px bold (large text threshold = 3:1).

---

## 6. Recommendations

### Priority 1 — Fix before any institutional user sees the app
1. **Darken `--text-faint`** (V-01): This single token fix eliminates the vast majority of violations across all pages. Suggested new value: `#6b6560`.
2. **Label the password input and visibility toggle** (V-02, V-03): Two-line fix in `Login.tsx`; blocks screen-reader users from completing authentication.

### Priority 2 — Fix before public launch
3. **Fix tab order on Login** (V-05): The login form is the entry point for all users; keyboard-only users (common in screen-reader workflows) are meaningfully slowed.
4. **Fix notification badge** (V-06): Darkening `bg-red-500` to `bg-red-700` is a one-line change.

### Priority 3 — Address before institutional partnerships
5. **Fix link-in-text-block on School Dashboard** (V-04): School admins are likely to include users with color vision deficiencies.
6. **Add `/slot/:id` to the accessibility test suite**: The opportunity detail page was not tested due to path mismatch; add a direct navigation test.

### Long-term
- Add `axe-core` to the pre-commit or CI pipeline (`npx playwright test tests/accessibility.spec.ts`) so regressions are caught before merge.
- Consider a `prefers-color-scheme: dark` audit once a dark mode is introduced — the warm-gray palette may require separate token tuning.
- Test all form flows (signup, forgot password, opportunity creation) — only authentication forms were audited here.
