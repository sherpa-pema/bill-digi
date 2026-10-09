# Graph Report - digi-bill-new  (2026-10-09)

## Corpus Check
- 24 files · ~67,910 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 335 nodes · 734 edges · 22 communities (16 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Core Dependencies & Build Config
- Admin Panel & Auth State Management
- POS Billing Views & Modals
- Billing State & Context Core
- Bill Share & Receipt Generation
- App TypeScript Configuration
- UI Component Aliases & System
- Node TypeScript Configuration
- Application Entrypoint & Error Boundary
- Shop Settings & Bill Counter Configuration
- Deployment Scripts & Packaging
- PWA Web App Manifest
- Agent Rules & QA Browser Testing
- Linter Rules & React Plugins
- Vercel Deployment & Rewrites
- Security Audit & RLS Policies
- UI Demos & Component Examples
- TypeScript Root Configuration
- Robots Search Crawler Policy
- React Asset Reference
- Vite Asset Reference

## God Nodes (most connected - your core abstractions)
1. `react` - 30 edges
2. `getSupabaseClient()` - 26 edges
3. `useShop()` - 24 edges
4. `useBilling()` - 23 edges
5. `Bill` - 21 edges
6. `compilerOptions` - 20 edges
7. `lucide-react` - 19 edges
8. `compilerOptions` - 15 edges
9. `Shop` - 13 edges
10. `BillingProvider()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `UI Browser Testing Skill` --references--> `Mobile & Tablet Responsiveness Rule`  [EXTRACTED]
  .agents/skills/ui-browser-testing/SKILL.md → AGENTS.md
- `BillDetailSheetProps` --references--> `Bill`  [EXTRACTED]
  src/components/history/BillDetailSheet.tsx → src/types/index.ts
- `ReceiptModalProps` --references--> `Bill`  [EXTRACTED]
  src/components/receipt/ReceiptModal.tsx → src/types/index.ts
- `ReceiptQrViewProps` --references--> `Bill`  [EXTRACTED]
  src/components/receipt/ReceiptQrView.tsx → src/types/index.ts
- `BillingContextType` --references--> `Bill`  [EXTRACTED]
  src/context/billingContextDef.ts → src/types/index.ts

## Import Cycles
- None detected.

## Communities (22 total, 6 thin omitted)

### Community 0 - "Core Dependencies & Build Config"
Cohesion: 0.05
Nodes (41): dependencies, clsx, html-to-image, lucide-react, qrcode.react, react, react-dom, @supabase/supabase-js (+33 more)

### Community 1 - "Admin Panel & Auth State Management"
Cohesion: 0.10
Nodes (35): @supabase/supabase-js, AdminPanel, AuthScreen, AdminPanel(), AdminPanelProps, AuthScreen(), AuthScreenProps, ShopProvider() (+27 more)

### Community 2 - "POS Billing Views & Modals"
Cohesion: 0.19
Nodes (22): lucide-react, qrcode.react, react, ManageItemsModal, UpgradeModal, BasketView(), CustomItemModal(), ItemizedModeView() (+14 more)

### Community 3 - "Billing State & Context Core"
Cohesion: 0.13
Nodes (32): RFC-4180, BillingProvider(), BillingContext, BillingContextType, checkIsOnline(), createItem(), deleteItem(), downloadBillsCsv() (+24 more)

### Community 4 - "Bill Share & Receipt Generation"
Cohesion: 0.13
Nodes (21): html-to-image, BillShareScreen, BillShareScreen(), BillDetailSheetProps, ReceiptCard, ReceiptCardProps, ReceiptModalProps, ReceiptQrViewProps (+13 more)

### Community 5 - "App TypeScript Configuration"
Cohesion: 0.09
Nodes (21): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+13 more)

### Community 6 - "UI Component Aliases & System"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 7 - "Node TypeScript Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "Application Entrypoint & Error Boundary"
Cohesion: 0.13
Nodes (8): SanoBill Web Entrypoint, react-dom, App(), src_assets_sano_bill_logo, ErrorBoundary, Props, State, src_index

### Community 9 - "Shop Settings & Bill Counter Configuration"
Cohesion: 0.19
Nodes (11): ShopSettingsModal, ShopSettingsModalContent(), setShopStartingBillNumber(), getBillShareParams(), isAdminRoute(), isBillShareRoute(), navigateToAdmin(), navigateToPOS() (+3 more)

### Community 10 - "Deployment Scripts & Packaging"
Cohesion: 0.18
Nodes (10): ref_node_child_process, ref_node_fs, ref_node_path, ref_node_url, deployDir, __dirname, distDir, __filename (+2 more)

### Community 11 - "PWA Web App Manifest"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 12 - "Agent Rules & QA Browser Testing"
Cohesion: 0.33
Nodes (6): Testing Viewport Matrix, UI Browser Testing Skill, Vivid QA Checklist, Git Push Restriction Rule, Mobile & Tablet Responsiveness Rule, Main Agent Orchestrator Instructions

### Community 13 - "Linter Rules & React Plugins"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 14 - "Vercel Deployment & Rewrites"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

### Community 15 - "Security Audit & RLS Policies"
Cohesion: 0.40
Nodes (5): Input Validation & Injection Rules, Security Rules, Supabase & Auth Security Rules, Security Audit Checklist, Security Audit Skill

## Knowledge Gaps
- **127 isolated node(s):** `AdminPanelProps`, `Props`, `State`, `clsx`, `html-to-image` (+122 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 153 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `POS Billing Views & Modals` to `Core Dependencies & Build Config`, `Admin Panel & Auth State Management`, `Billing State & Context Core`, `Bill Share & Receipt Generation`, `Application Entrypoint & Error Boundary`, `Shop Settings & Bill Counter Configuration`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `POS Billing Views & Modals` to `Core Dependencies & Build Config`, `Admin Panel & Auth State Management`, `Bill Share & Receipt Generation`, `Application Entrypoint & Error Boundary`, `Shop Settings & Bill Counter Configuration`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `AdminPanelProps`, `Props`, `State` to the rest of the system?**
  _127 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Dependencies & Build Config` be split into smaller, more focused modules?**
  _Cohesion score 0.0463768115942029 - nodes in this community are weakly interconnected._
- **Should `Admin Panel & Auth State Management` be split into smaller, more focused modules?**
  _Cohesion score 0.10465116279069768 - nodes in this community are weakly interconnected._
- **Should `Billing State & Context Core` be split into smaller, more focused modules?**
  _Cohesion score 0.12802275960170698 - nodes in this community are weakly interconnected._
- **Should `Bill Share & Receipt Generation` be split into smaller, more focused modules?**
  _Cohesion score 0.12615384615384614 - nodes in this community are weakly interconnected._