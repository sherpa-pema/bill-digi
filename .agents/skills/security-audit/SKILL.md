---
name: security-audit
description: >-
  Use this skill when the user asks to review, audit, or scan the codebase for
  security vulnerabilities, bugs, or error-prone patterns. Covers Supabase auth,
  RLS policies, environment secrets, client-side data handling, and dependency risks.
---

# Security Audit — DigiBill

A comprehensive, on-demand security review procedure for the DigiBill POS application.

## Stack Context

| Layer          | Technology                    |
| :------------- | :---------------------------- |
| Frontend       | React 19, TypeScript 6, Vite 8 |
| Styling        | Tailwind CSS 4                |
| Backend/Auth   | Supabase (Auth + Postgres)    |
| Hosting        | Vercel (SPA rewrites)         |
| Icons          | lucide-react                  |
| Linting        | oxlint                        |

## Audit Checklist

### 1. Authentication & Session Management
- [ ] Verify `loginBusiness()` and `registerBusiness()` in `src/lib/authService.ts` handle errors without leaking internal details.
- [ ] Confirm sessions are validated on every protected operation (not just on initial login).
- [ ] Check that `getActiveUser()` gracefully handles expired or revoked sessions.
- [ ] Ensure logout properly clears all local state, tokens, and cached data.

### 2. Supabase Row Level Security (RLS)
- [ ] Verify RLS policies exist on `shops`, `items`, and `bills` tables in `supabase/` schema files.
- [ ] Confirm that a shop can only read/write its own data (no cross-tenant leakage).
- [ ] Test that unauthenticated requests are rejected by RLS policies.

### 3. Environment & Secret Exposure
- [ ] Confirm `.env` is in `.gitignore`.
- [ ] Verify no secrets appear in committed source files (grep for hardcoded keys/URLs).
- [ ] Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only env vars exposed to the client bundle.
- [ ] Ensure no `console.log` statements leak tokens or user data.

### 4. Input Sanitization
- [ ] Audit all user input fields (business name, PAN, item name, price, quantity) for validation before Supabase calls.
- [ ] Confirm that bill generation (`generateBill()` in `src/lib/dbService.ts`) does not accept negative or zero quantities/prices.
- [ ] Check for XSS vectors in any user-supplied strings rendered in the UI or bills.

### 5. Client-Side Data Handling
- [ ] Verify no sensitive data (passwords, full session tokens) is stored in `localStorage` or `sessionStorage` beyond what Supabase Auth manages.
- [ ] Check that `generateId()` in `src/lib/storage.ts` produces cryptographically safe IDs (or confirm collisions are acceptable).

### 6. Dependency & Build Security
- [ ] Run `npm audit` and report vulnerabilities.
- [ ] Verify Vite does not serve source maps in production (`build.sourcemap` should be `false` or `hidden`).
- [ ] Confirm `vercel.json` rewrites do not expose API internals or development endpoints.

### 7. TypeScript & Lint Hygiene
- [ ] Check that `tsconfig.app.json` has `strict: true`.
- [ ] Verify oxlint rules in `.oxlintrc.json` include `react/rules-of-hooks` and security-related lint rules.
- [ ] Look for `any` type usage that could mask runtime errors (especially in `AuthResult.user?: any`).

## Reporting

After completing the audit, produce a summary artifact with:
1. **Critical** — issues that could lead to data exposure or auth bypass.
2. **Warning** — issues that weaken the security posture but are not immediately exploitable.
3. **Info** — recommendations for hardening and best practices.
