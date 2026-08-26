# Graph Report - digi-bill-new  (2026-08-26)

## Corpus Check
- 6 files · ~49,381 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 226 nodes · 307 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- DigiBill Core POS Application
- Client TypeScript & DOM Configuration
- Node & Vite Build System
- Core Production Dependencies
- Developer & Linter Tooling
- Package Scripts & User Database Schema
- UI Components & Path Aliases
- Authentication & Admin Service
- Linter Rules & Web Entry
- Local Storage & Session State
- Agent Rules & Browser QA Testing
- Vercel Deployment & Rewrites
- Security Audit & Input Validation
- LumaSpin & Loading UI Components
- TypeScript Root Project References
- Sano Bill Logo Graphic
- App SVG Icons
- Public Brand Assets
- React Brand Asset
- Vite Brand Asset

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 19 edges
2. `compilerOptions` - 15 edges
3. `App()` - 11 edges
4. `Shop` - 8 edges
5. `Item` - 7 edges
6. `Bill` - 7 edges
7. `generateId()` - 6 edges
8. `aliases` - 6 edges
9. `scripts` - 5 edges
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
- **Inventory Catalog Management & Cloud Sync** — src_lib_dbservice_fetchitems, src_lib_dbservice_createitem, src_types_index_item, supabase_schema_items [INFERRED 0.85]
- **Point of Sale Bill Generation & Ledger** — src_app_app, src_lib_dbservice_generatebill, src_types_index_bill, supabase_schema_bills [INFERRED 0.85]

## Communities (21 total, 7 thin omitted)

### Community 0 - "DigiBill Core POS Application"
Cohesion: 0.12
Nodes (31): DigiBill Standalone Prototype, DigiBill POS & Chit System, DigiBill Key Features, App(), formatDateTime(), formatShortDateTime(), getBillBreakdown(), React Component Logo PNG (+23 more)

### Community 1 - "Client TypeScript & DOM Configuration"
Cohesion: 0.08
Nodes (24): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+16 more)

### Community 2 - "Node & Vite Build System"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 3 - "Core Production Dependencies"
Cohesion: 0.11
Nodes (17): clsx, html-to-image, lucide-react, dependencies, clsx, html-to-image, lucide-react, qrcode.react (+9 more)

### Community 4 - "Developer & Linter Tooling"
Cohesion: 0.12
Nodes (18): oxlint, devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom (+10 more)

### Community 5 - "Package Scripts & User Database Schema"
Cohesion: 0.12
Nodes (16): auth.users, name, private, scripts, build, dev, lint, preview (+8 more)

### Community 6 - "UI Components & Path Aliases"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 7 - "Authentication & Admin Service"
Cohesion: 0.25
Nodes (14): Auth Hero Banner Image, AuthScreen(), AuthScreenProps, ADMIN_EMAILS, AuthResult, loginBusiness(), LoginParams, registerBusiness() (+6 more)

### Community 8 - "Linter Rules & Web Entry"
Cohesion: 0.12
Nodes (13): Vite Web Index Entry, plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, typescript, Favicon Vector (+5 more)

### Community 9 - "Local Storage & Session State"
Cohesion: 0.27
Nodes (6): Vercel Deployment Flow, getItem(), setItem(), STORAGE_KEYS, getSupabaseClient(), SyncConfig

### Community 10 - "Agent Rules & Browser QA Testing"
Cohesion: 0.33
Nodes (6): Testing Viewport Matrix, UI Browser Testing Skill, Vivid QA Checklist, Git Push Restriction Rule, Mobile & Tablet Responsiveness Rule, Main Agent Orchestrator Instructions

### Community 11 - "Vercel Deployment & Rewrites"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

### Community 12 - "Security Audit & Input Validation"
Cohesion: 0.40
Nodes (5): Input Validation & Injection Rules, Security Rules, Supabase & Auth Security Rules, Security Audit Checklist, Security Audit Skill

## Knowledge Gaps
- **99 isolated node(s):** `DigiBill Standalone Prototype`, `Vercel Deployment Flow`, `DigiBill POS & Chit System`, `buildCommand`, `framework` (+94 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Core Production Dependencies` to `Package Scripts & User Database Schema`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Developer & Linter Tooling` to `Linter Rules & Web Entry`, `Package Scripts & User Database Schema`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `@supabase/supabase-js` connect `Core Production Dependencies` to `Local Storage & Session State`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `DigiBill Standalone Prototype` and `DigiBill POS & Chit System`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DigiBill Standalone Prototype`, `Vercel Deployment Flow`, `DigiBill POS & Chit System` to the rest of the system?**
  _99 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DigiBill Core POS Application` be split into smaller, more focused modules?**
  _Cohesion score 0.11586452762923351 - nodes in this community are weakly interconnected._
- **Should `Client TypeScript & DOM Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._