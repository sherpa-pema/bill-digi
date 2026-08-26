# Graph Report - digi-bill-new  (2026-08-26)

## Corpus Check
- Corpus is ~38,716 words - fits in a single context window. You may not need a graph.

## Summary
- 196 nodes · 293 edges · 17 communities (11 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- POS Billing & UI State
- App TypeScript Configuration
- Dev Tooling & Build Dependencies
- Vite & Node Build Config
- Business Auth & Cloud Services
- Runtime UI & Icon Dependencies
- UI Component Architecture & Aliases
- Project Manifest & User Schema
- Linter Rules & Code Quality
- Vercel Hosting & SPA Routing
- UI Spin Animations
- Root TypeScript Project References
- Web Entry & Favicon
- Brand Graphic Assets
- App SVG Icon Assets
- Public Brand Static Assets

## God Nodes (most connected - your core abstractions)
1. `App()` - 22 edges
2. `compilerOptions` - 19 edges
3. `getSupabaseClient()` - 17 edges
4. `compilerOptions` - 15 edges
5. `generateId()` - 8 edges
6. `Shop` - 7 edges
7. `Item` - 7 edges
8. `Bill` - 7 edges
9. `aliases` - 6 edges
10. `tailwind` - 5 edges

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
- **Point of Sale Bill Generation & Ledger** — src_app_app, src_lib_dbservice_generatebill, src_types_index_bill, supabase_schema_bills [INFERRED 0.85]
- **Inventory Catalog Management & Cloud Sync** — src_lib_dbservice_fetchitems, src_lib_dbservice_createitem, src_types_index_item, supabase_schema_items [INFERRED 0.85]

## Communities (17 total, 6 thin omitted)

### Community 0 - "POS Billing & UI State"
Cohesion: 0.17
Nodes (26): DigiBill Standalone Prototype, react-dom/client, DigiBill POS & Chit System, DigiBill Key Features, App(), formatDateTime(), formatShortDateTime(), React Component Logo PNG (+18 more)

### Community 1 - "App TypeScript Configuration"
Cohesion: 0.08
Nodes (24): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+16 more)

### Community 2 - "Dev Tooling & Build Dependencies"
Cohesion: 0.10
Nodes (20): oxlint, devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom (+12 more)

### Community 3 - "Vite & Node Build Config"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 4 - "Business Auth & Cloud Services"
Cohesion: 0.24
Nodes (13): Vercel Deployment Flow, Auth Hero Banner Image, AuthScreen(), AuthScreenProps, AuthResult, loginBusiness(), LoginParams, registerBusiness() (+5 more)

### Community 5 - "Runtime UI & Icon Dependencies"
Cohesion: 0.12
Nodes (15): clsx, lucide-react, dependencies, clsx, lucide-react, qrcode.react, react, react-dom (+7 more)

### Community 6 - "UI Component Architecture & Aliases"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 7 - "Project Manifest & User Schema"
Cohesion: 0.14
Nodes (14): auth.users, name, private, scripts, build, dev, lint, preview (+6 more)

### Community 8 - "Linter Rules & Code Quality"
Cohesion: 0.20
Nodes (9): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, react, typescript (+1 more)

### Community 9 - "Vercel Hosting & SPA Routing"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

## Knowledge Gaps
- **90 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+85 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Runtime UI & Icon Dependencies` to `Project Manifest & User Schema`?**
  _High betweenness centrality (0.203) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Dev Tooling & Build Dependencies` to `Project Manifest & User Schema`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Runtime UI & Icon Dependencies` to `POS Billing & UI State`, `Business Auth & Cloud Services`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `DigiBill Standalone Prototype` and `DigiBill POS & Chit System`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _90 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Dev Tooling & Build Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10476190476190476 - nodes in this community are weakly interconnected._