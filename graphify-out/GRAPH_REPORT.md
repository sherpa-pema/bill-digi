# Graph Report - digi-bill-new  (2026-08-27)

## Corpus Check
- Corpus is ~47,780 words - fits in a single context window. You may not need a graph.

## Summary
- 263 nodes · 582 edges · 21 communities (17 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Admin Console & State Contexts
- Core Billing Screens & POS UI
- Core Production Dependencies
- Client TypeScript & DOM Configuration
- Receipt Rendering & History Ledger
- Node & Vite Build System
- Developer & Linter Tooling
- UI Components & Path Aliases
- Authentication & Context Definitions
- Linter Rules & React Configuration
- Agent Rules & Browser QA Testing
- Vercel Deployment & Rewrites
- Security Audit & Input Validation
- LumaSpin & Loading UI Components
- TypeScript Root References
- React Logo Graphic
- Vite Logo Graphic

## God Nodes (most connected - your core abstractions)
1. `useBilling()` - 29 edges
2. `react` - 28 edges
3. `useShop()` - 27 edges
4. `getSupabaseClient()` - 22 edges
5. `Bill` - 19 edges
6. `compilerOptions` - 19 edges
7. `compilerOptions` - 15 edges
8. `BillingProvider()` - 14 edges
9. `useReceiptExport()` - 12 edges
10. `Shop` - 12 edges

## Surprising Connections (you probably didn't know these)
- `UI Browser Testing Skill` --references--> `Mobile & Tablet Responsiveness Rule`  [EXTRACTED]
  .agents/skills/ui-browser-testing/SKILL.md → AGENTS.md
- `AuthScreenProps` --references--> `Bill`  [EXTRACTED]
  src/components/AuthScreen.tsx → src/types/index.ts
- `AuthScreenProps` --references--> `Shop`  [EXTRACTED]
  src/components/AuthScreen.tsx → src/types/index.ts
- `BillDetailSheetProps` --references--> `Bill`  [EXTRACTED]
  src/components/history/BillDetailSheet.tsx → src/types/index.ts
- `BillDetailSheet()` --calls--> `useBilling()`  [EXTRACTED]
  src/components/history/BillDetailSheet.tsx → src/hooks/useBilling.ts

## Import Cycles
- None detected.

## Communities (21 total, 4 thin omitted)

### Community 0 - "Admin Console & State Contexts"
Cohesion: 0.15
Nodes (33): AdminPanel(), AdminPanelProps, BillingProvider(), ShopProvider(), ShopContext, ShopContextType, getActiveUser(), signOutBusiness() (+25 more)

### Community 1 - "Core Billing Screens & POS UI"
Cohesion: 0.22
Nodes (18): react, App(), AppContent(), BasketView(), CustomItemModal(), ItemizedModeView(), Keypad(), NewBillScreen() (+10 more)

### Community 2 - "Core Production Dependencies"
Cohesion: 0.07
Nodes (26): clsx, html-to-image, lucide-react, dependencies, clsx, html-to-image, lucide-react, qrcode.react (+18 more)

### Community 3 - "Client TypeScript & DOM Configuration"
Cohesion: 0.08
Nodes (24): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+16 more)

### Community 4 - "Receipt Rendering & History Ledger"
Cohesion: 0.25
Nodes (14): BillDetailSheet(), BillDetailSheetProps, ReceiptCard, ReceiptCardProps, ReceiptModal(), ReceiptModalProps, ReceiptQrView(), ReceiptQrViewProps (+6 more)

### Community 5 - "Node & Vite Build System"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 6 - "Developer & Linter Tooling"
Cohesion: 0.11
Nodes (19): oxlint, devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom (+11 more)

### Community 7 - "UI Components & Path Aliases"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 8 - "Authentication & Context Definitions"
Cohesion: 0.18
Nodes (14): AuthScreen(), AuthScreenProps, BillingContext, BillingContextType, ADMIN_EMAILS, AdminCheckable, AuthResult, getAdminEmails() (+6 more)

### Community 9 - "Linter Rules & React Configuration"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

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
- **97 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Core Billing Screens & POS UI` to `Admin Console & State Contexts`, `Linter Rules & React Configuration`, `Receipt Rendering & History Ledger`, `Authentication & Context Definitions`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `plugins` connect `Linter Rules & React Configuration` to `Core Billing Screens & POS UI`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Developer & Linter Tooling` to `Core Production Dependencies`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Console & State Contexts` be split into smaller, more focused modules?**
  _Cohesion score 0.14634146341463414 - nodes in this community are weakly interconnected._
- **Should `Core Production Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Client TypeScript & DOM Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._