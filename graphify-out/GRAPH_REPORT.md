# Graph Report - digi-bill-new  (2026-08-26)

## Corpus Check
- 12 files · ~42,893 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 211 nodes · 281 edges · 20 communities (13 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.92)
- Token cost: 1,200 input · 800 output

## Community Hubs (Navigation)
- POS UI & Billing Engine
- App TypeScript Compiler Config
- Linting & Build Tooling
- Vite Node Configuration
- Package Scripts & User Auth
- Core UI Dependencies
- Shadcn Component Aliases
- Linter Rules & HTML Entry
- Local Storage & State
- Agent & UI Testing Guidelines
- Vercel Routing & Deployment
- Security & RLS Policies
- Demo & Spinner Components
- Root TypeScript Project References
- App Brand Assets
- Public SVG Icons
- Public Brand Assets
- React Framework Vector
- Vite Bundler Vector

## God Nodes (most connected - your core abstractions)
1. `App()` - 20 edges
2. `compilerOptions` - 19 edges
3. `compilerOptions` - 15 edges
4. `Shop` - 7 edges
5. `Item` - 7 edges
6. `Bill` - 7 edges
7. `aliases` - 6 edges
8. `tailwind` - 5 edges
9. `scripts` - 5 edges
10. `AuthScreen()` - 5 edges

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

### Community 0 - "POS UI & Billing Engine"
Cohesion: 0.13
Nodes (34): DigiBill Standalone Prototype, DigiBill POS & Chit System, DigiBill Key Features, App(), formatDateTime(), formatShortDateTime(), getBillBreakdown(), Auth Hero Banner Image (+26 more)

### Community 1 - "App TypeScript Compiler Config"
Cohesion: 0.08
Nodes (24): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+16 more)

### Community 2 - "Linting & Build Tooling"
Cohesion: 0.11
Nodes (19): oxlint, devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom (+11 more)

### Community 3 - "Vite Node Configuration"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 4 - "Package Scripts & User Auth"
Cohesion: 0.12
Nodes (16): auth.users, name, private, scripts, build, dev, lint, preview (+8 more)

### Community 5 - "Core UI Dependencies"
Cohesion: 0.12
Nodes (15): clsx, lucide-react, dependencies, clsx, lucide-react, qrcode.react, react, react-dom (+7 more)

### Community 6 - "Shadcn Component Aliases"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 7 - "Linter Rules & HTML Entry"
Cohesion: 0.13
Nodes (12): Vite Web Index Entry, plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, Favicon Vector, react-dom/client (+4 more)

### Community 8 - "Local Storage & State"
Cohesion: 0.31
Nodes (5): Vercel Deployment Flow, getItem(), setItem(), STORAGE_KEYS, getSupabaseClient()

### Community 9 - "Agent & UI Testing Guidelines"
Cohesion: 0.33
Nodes (6): Testing Viewport Matrix, UI Browser Testing Skill, Vivid QA Checklist, Git Push Restriction Rule, Mobile & Tablet Responsiveness Rule, Main Agent Orchestrator Instructions

### Community 10 - "Vercel Routing & Deployment"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

### Community 11 - "Security & RLS Policies"
Cohesion: 0.40
Nodes (5): Input Validation & Injection Rules, Security Rules, Supabase & Auth Security Rules, Security Audit Checklist, Security Audit Skill

## Knowledge Gaps
- **96 isolated node(s):** `allowArbitraryExtensions`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `jsx`, `module` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Core UI Dependencies` to `Package Scripts & User Auth`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Linting & Build Tooling` to `Package Scripts & User Auth`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `DigiBill Standalone Prototype` and `DigiBill POS & Chit System`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `allowArbitraryExtensions`, `allowImportingTsExtensions`, `erasableSyntaxOnly` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `POS UI & Billing Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.13360323886639677 - nodes in this community are weakly interconnected._
- **Should `App TypeScript Compiler Config` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Linting & Build Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._