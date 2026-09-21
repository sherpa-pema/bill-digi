# Graph Report - digi-bill-new  (2026-09-21)

## Corpus Check
- 73 files · ~58,746 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .css 2, .example 1, (none) 1)

## Summary
- 284 nodes · 717 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Core Dependencies & Packages
- POS Billing Views & State Context
- Admin Console & Database Operations
- Application Layout & Core Routing
- Authentication & Shop Identity
- App TypeScript Configuration
- BillShare & Customer Receipt System
- UI Component Aliases & Icons
- Node Build Configuration
- Agent Rules & Browser QA
- Linter Rules & React Plugins
- Vercel Deployment & Rewrites
- Security Audit & RLS Policies
- TypeScript Root References
- React Asset Reference
- Vite Asset Reference

## God Nodes (most connected - your core abstractions)
1. `react` - 29 edges
2. `useShop()` - 29 edges
3. `useBilling()` - 27 edges
4. `getSupabaseClient()` - 25 edges
5. `Bill` - 21 edges
6. `compilerOptions` - 19 edges
7. `lucide-react` - 18 edges
8. `BillingProvider()` - 16 edges
9. `ShopProvider()` - 16 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `ReceiptQrViewProps` --references--> `Bill`  [EXTRACTED]
  src/components/receipt/ReceiptQrView.tsx → src/types/index.ts
- `UI Browser Testing Skill` --references--> `Mobile & Tablet Responsiveness Rule`  [EXTRACTED]
  .agents/skills/ui-browser-testing/SKILL.md → AGENTS.md
- `AppContent()` --calls--> `useBilling()`  [EXTRACTED]
  src/App.tsx → src/hooks/useBilling.ts
- `AppContent()` --calls--> `useShop()`  [EXTRACTED]
  src/App.tsx → src/hooks/useShop.ts
- `AdminPanel()` --calls--> `navigateToPOS()`  [EXTRACTED]
  src/components/AdminPanel.tsx → src/lib/navigation.ts

## Import Cycles
- None detected.

## Communities (17 total, 4 thin omitted)

### Community 0 - "Core Dependencies & Packages"
Cohesion: 0.05
Nodes (41): dependencies, clsx, html-to-image, lucide-react, qrcode.react, react, react-dom, @supabase/supabase-js (+33 more)

### Community 1 - "POS Billing Views & State Context"
Cohesion: 0.19
Nodes (21): RFC-4180, lucide-react, react, BasketView(), CustomItemModal(), ItemizedModeView(), Keypad(), NewBillScreen() (+13 more)

### Community 2 - "Admin Console & Database Operations"
Cohesion: 0.16
Nodes (31): AdminPanel(), AdminPanelProps, BillingProvider(), signOutBusiness(), activateShopSubscription(), checkIsOnline(), createInitialShop(), createItem() (+23 more)

### Community 3 - "Application Layout & Core Routing"
Cohesion: 0.16
Nodes (22): ref_components, react-dom, App(), AppContent(), ManageItemsModal(), Header(), NetworkStatusBar(), ShopSettingsModal() (+14 more)

### Community 4 - "Authentication & Shop Identity"
Cohesion: 0.13
Nodes (26): src_assets_sano_bill_logo, AuthScreen(), AuthScreenProps, BillDetailSheetProps, ReceiptCardProps, ReceiptModalProps, BillingContext, BillingContextType (+18 more)

### Community 5 - "App TypeScript Configuration"
Cohesion: 0.10
Nodes (20): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+12 more)

### Community 6 - "BillShare & Customer Receipt System"
Cohesion: 0.16
Nodes (14): html-to-image, qrcode.react, BillShareScreen(), ReceiptQrView(), ReceiptQrViewProps, LumaSpin, CompactBillPayload, decodeBillData() (+6 more)

### Community 7 - "UI Component Aliases & Icons"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 8 - "Node Build Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 9 - "Agent Rules & Browser QA"
Cohesion: 0.33
Nodes (6): Testing Viewport Matrix, UI Browser Testing Skill, Vivid QA Checklist, Git Push Restriction Rule, Mobile & Tablet Responsiveness Rule, Main Agent Orchestrator Instructions

### Community 10 - "Linter Rules & React Plugins"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 11 - "Vercel Deployment & Rewrites"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

### Community 12 - "Security Audit & RLS Policies"
Cohesion: 0.40
Nodes (5): Input Validation & Injection Rules, Security Rules, Supabase & Auth Security Rules, Security Audit Checklist, Security Audit Skill

## Knowledge Gaps
- **102 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `$schema` (+97 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 112 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `POS Billing Views & State Context` to `Core Dependencies & Packages`, `Admin Console & Database Operations`, `Application Layout & Core Routing`, `Authentication & Shop Identity`, `BillShare & Customer Receipt System`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `POS Billing Views & State Context` to `Core Dependencies & Packages`, `Admin Console & Database Operations`, `Application Layout & Core Routing`, `Authentication & Shop Identity`, `BillShare & Customer Receipt System`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _102 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Dependencies & Packages` be split into smaller, more focused modules?**
  _Cohesion score 0.047474747474747475 - nodes in this community are weakly interconnected._
- **Should `Authentication & Shop Identity` be split into smaller, more focused modules?**
  _Cohesion score 0.12873563218390804 - nodes in this community are weakly interconnected._
- **Should `App TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `UI Component Aliases & Icons` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._