# Security Rules — DigiBill

These rules are **always active** and apply to every code change in the project.

## 1. Supabase & Authentication
- Never hardcode Supabase URLs, anon keys, or service-role keys in source files. All secrets must come from `VITE_SUPABASE_*` environment variables.
- Never expose service-role keys or admin credentials on the client side. Only the anon key (`VITE_SUPABASE_ANON_KEY`) may be used in browser code.
- Always validate that the user has an active Supabase session before performing database operations on protected tables.
- Use Supabase Row Level Security (RLS) policies as the primary authorization layer — never rely solely on client-side checks.

## 2. Input Validation & Injection
- Sanitize and validate all user inputs (business name, PAN number, identifiers, item names, prices) before passing them to Supabase queries.
- Use parameterized queries via the Supabase JS client — never construct raw SQL strings.
- Escape or sanitize any user-provided data rendered in the DOM to prevent XSS.

## 3. Environment & Secrets
- The `.env` file must be listed in `.gitignore` and must never be committed.
- Only `.env.example` (with placeholder values) may be version-controlled.
- Never log secrets, tokens, or session data to the browser console in production builds.

## 4. Dependency Safety
- Do not add new npm dependencies without evaluating their maintenance status and bundle size impact.
- Prefer well-maintained packages with active security advisory coverage.

## 5. Build & Deployment
- Vite's `define` or `import.meta.env` must be the only mechanism for injecting environment variables.
- Never disable TypeScript strict mode or `noEmit` checks in `tsconfig.app.json`.
- Vercel deployment config (`vercel.json`) must not expose internal routes or source maps to the public.
