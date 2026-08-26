# Graph Report - digi-bill-new  (2026-08-26)

## Corpus Check
- 9 files · ~49,071 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 226 nodes · 336 edges · 20 communities (13 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- POS Application & Data Services
- Authentication & Admin Management
- Client TypeScript Configuration
- Node & Build TypeScript Configuration
- UI Runtime Dependencies & Utilities
- Vite & Tailwind Build Tooling
- Package Scripts & Supabase Schema
- Component Design System Configuration
- Oxlint Linter Configuration
- Agent Orchestration & Testing Rules
- Vercel Deployment Configuration
- Security Rules & Audit Checklist
- UI Components & Animations
- TypeScript Project References
- Brand Assets
- Icon Assets
- Public Logo Assets
- React Asset Icons
- Vite Asset Icons

## God Nodes (most connected - your core abstractions)
1. `App()` - 25 edges
2. `compilerOptions` - 19 edges
3. `compilerOptions` - 15 edges
4. `AdminPanel()` - 11 edges
5. `generateId()` - 9 edges
6. `Shop` - 8 edges
7. `isUserAdmin()` - 7 edges
8. `loginBusiness()` - 7 edges
9. `Item` - 7 edges
10. `Bill` - 7 edges

## Surprising Connections (you probably didn't know these)
- `DigiBill Standalone Prototype` --semantically_similar_to--> `App()`  [INFERRED] [semantically similar]
  digi-bill.html → src/App.tsx
- `DigiBill POS & Chit System` --implements--> `App()`  [INFERRED]
  README.md → src/App.tsx
- `DigiBill Key Features` --references--> `fetchItems()`  [INFERRED]
  README.md → src/lib/dbService.ts
- `DigiBill Key Features` --references--> `generateBill()`  [INFERRED]
  README.md → src/lib/dbService.ts
- `Vite Web Index Entry` --references--> `Favicon Vector`  [EXTRACTED]
  index.html → public/favicon.svg

## Import Cycles
- 1-file cycle: `vite.config.ts -> vite.config.ts`

## Hyperedges (group relationships)
- **Business Authentication & User Session Lifecycle** — src_components_authscreen_authscreen, src_lib_authservice_loginbusiness, src_lib_authservice_registerbusiness, src_lib_authservice_getactiveuser, auth_users [INFERRED 0.85]
- **Inventory Catalog Management & Cloud Sync** — src_lib_dbservice_fetchitems, src_lib_dbservice_createitem, src_types_index_item, supabase_schema_items [INFERRED 0.85]
- **Point of Sale Bill Generation & Ledger** — src_app_app, src_lib_dbservice_generatebill, src_types_index_bill, supabase_schema_bills [INFERRED 0.85]

## Communities (20 total, 7 thin omitted)

### Community 0 - "POS Application & Data Services"
Cohesion: 0.12
Nodes (30): DigiBill Standalone Prototype, Vite Web Index Entry, Favicon Vector, react-dom/client, Vercel Deployment Flow, DigiBill POS & Chit System, DigiBill Key Features, App() (+22 more)

### Community 1 - "Authentication & Admin Management"
Cohesion: 0.16
Nodes (24): Auth Hero Banner Image, AdminPanel(), AdminPanelProps, AuthScreen(), AuthScreenProps, ADMIN_EMAILS, AuthResult, isUserAdmin() (+16 more)

### Community 2 - "Client TypeScript Configuration"
Cohesion: 0.08
Nodes (24): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+16 more)

### Community 3 - "Node & Build TypeScript Configuration"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 4 - "UI Runtime Dependencies & Utilities"
Cohesion: 0.11
Nodes (17): clsx, html-to-image, lucide-react, dependencies, clsx, html-to-image, lucide-react, qrcode.react (+9 more)

### Community 5 - "Vite & Tailwind Build Tooling"
Cohesion: 0.12
Nodes (18): oxlint, devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom (+10 more)

### Community 6 - "Package Scripts & Supabase Schema"
Cohesion: 0.12
Nodes (16): auth.users, name, private, scripts, build, dev, lint, preview (+8 more)

### Community 7 - "Component Design System Configuration"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 8 - "Oxlint Linter Configuration"
Cohesion: 0.18
Nodes (10): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, typescript, oxc, react (+2 more)

### Community 9 - "Agent Orchestration & Testing Rules"
Cohesion: 0.33
Nodes (6): Testing Viewport Matrix, UI Browser Testing Skill, Vivid QA Checklist, Git Push Restriction Rule, Mobile & Tablet Responsiveness Rule, Main Agent Orchestrator Instructions

### Community 10 - "Vercel Deployment Configuration"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

### Community 11 - "Security Rules & Audit Checklist"
Cohesion: 0.40
Nodes (5): Input Validation & Injection Rules, Security Rules, Supabase & Auth Security Rules, Security Audit Checklist, Security Audit Skill

## Knowledge Gaps
- **99 isolated node(s):** `DigiBill Standalone Prototype`, `DigiBill POS & Chit System`, `Vercel Deployment Flow`, `allowArbitraryExtensions`, `allowImportingTsExtensions` (+94 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `UI Runtime Dependencies & Utilities` to `Package Scripts & Supabase Schema`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Vite & Tailwind Build Tooling` to `Oxlint Linter Configuration`, `Package Scripts & Supabase Schema`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `@supabase/supabase-js` connect `UI Runtime Dependencies & Utilities` to `POS Application & Data Services`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `DigiBill Standalone Prototype` and `DigiBill POS & Chit System`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DigiBill Standalone Prototype`, `DigiBill POS & Chit System`, `Vercel Deployment Flow` to the rest of the system?**
  _99 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `POS Application & Data Services` be split into smaller, more focused modules?**
  _Cohesion score 0.1166429587482219 - nodes in this community are weakly interconnected._
- **Should `Client TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._