# Graph Report - digi-bill-new  (2026-10-07)

## Corpus Check
- 79 files · ~60,715 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .css 2, .example 1)

## Summary
- 327 nodes · 733 edges · 22 communities (16 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 1,200 input · 800 output

## Community Hubs (Navigation)
- BillShare & Receipt Components
- Admin Panel & Database Operations
- Shop Context & Settings Management
- Application Entrypoint & Error Boundary
- Supabase Authentication & Services
- Core Dependencies & Packages
- UI Demos & Component Examples
- POS Billing Views & Modals
- Deployment Scripts & Packaging
- PWA Web App Manifest
- Linter Rules & React Plugins
- Vercel Deployment & Rewrites
- TypeScript Root Configuration
- App TypeScript Configuration
- UI Component Aliases & System
- Node TypeScript Configuration
- Agent Rules & QA Browser Testing
- Security Audit & RLS Policies
- React Asset Reference
- Vite Asset Reference
- Robots Search Crawler Policy

## God Nodes (most connected - your core abstractions)
1. `react` - 30 edges
2. `useShop()` - 26 edges
3. `useBilling()` - 25 edges
4. `getSupabaseClient()` - 24 edges
5. `Bill` - 20 edges
6. `compilerOptions` - 20 edges
7. `lucide-react` - 19 edges
8. `compilerOptions` - 15 edges
9. `BillingProvider()` - 14 edges
10. `Shop` - 11 edges

## Surprising Connections (you probably didn't know these)
- `UI Browser Testing Skill` --references--> `Mobile & Tablet Responsiveness Rule`  [EXTRACTED]
  .agents/skills/ui-browser-testing/SKILL.md → AGENTS.md
- `BillDetailSheetProps` --references--> `Bill`  [EXTRACTED]
  src/components/history/BillDetailSheet.tsx → src/types/index.ts
- `ReceiptModalProps` --references--> `Bill`  [EXTRACTED]
  src/components/receipt/ReceiptModal.tsx → src/types/index.ts
- `ReceiptQrViewProps` --references--> `Bill`  [EXTRACTED]
  src/components/receipt/ReceiptQrView.tsx → src/types/index.ts
- `BillShareScreen()` --calls--> `fetchBillById()`  [EXTRACTED]
  src/components/billshare/BillShareScreen.tsx → src/lib/dbService.ts

## Import Cycles
- None detected.

## Communities (22 total, 6 thin omitted)

### Community 1 - "BillShare & Receipt Components"
Cohesion: 0.09
Nodes (32): BillDetailSheetProps, ReceiptCardProps, ReceiptModalProps, ReceiptQrViewProps, BillingContextType, CompactBillPayload, AdminShopsFetchResult, BasketItem (+24 more)

### Community 3 - "Admin Panel & Database Operations"
Cohesion: 0.16
Nodes (31): AdminPanelProps, ShopAdminView, SubscriptionPayment, AdminPanel(), BillingProvider(), signOutBusiness(), activateShopSubscription(), createInitialShop() (+23 more)

### Community 4 - "Shop Context & Settings Management"
Cohesion: 0.16
Nodes (20): ShopContextType, AppContent(), ShopSettingsModalContent(), ShopProvider(), checkIsAdminServerSide(), getActiveUser(), isUserAdmin(), checkIsOnline() (+12 more)

### Community 8 - "Application Entrypoint & Error Boundary"
Cohesion: 0.13
Nodes (8): ErrorBoundary, Props, State, App(), react-dom, src_assets_sano_bill_logo, src_index, SanoBill Web Entrypoint

### Community 9 - "Supabase Authentication & Services"
Cohesion: 0.17
Nodes (11): AuthScreenProps, AdminCheckable, AuthResult, LoginParams, RegisterParams, AuthScreen(), loginBusiness(), registerBusiness() (+3 more)

### Community 0 - "Core Dependencies & Packages"
Cohesion: 0.05
Nodes (42): dependencies, clsx, html-to-image, lucide-react, qrcode.react, react, react-dom, @supabase/supabase-js (+34 more)

### Community 2 - "POS Billing Views & Modals"
Cohesion: 0.22
Nodes (20): BasketView(), CustomItemModal(), ItemizedModeView(), Keypad(), NewBillScreen(), SimpleModeView(), BillDetailSheet(), HistoryScreen() (+12 more)

### Community 10 - "Deployment Scripts & Packaging"
Cohesion: 0.18
Nodes (10): deployDir, __dirname, distDir, __filename, htaccessPath, rootDir, ref_node_child_process, ref_node_fs (+2 more)

### Community 11 - "PWA Web App Manifest"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 13 - "Linter Rules & React Plugins"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 14 - "Vercel Deployment & Rewrites"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

### Community 5 - "App TypeScript Configuration"
Cohesion: 0.09
Nodes (21): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+13 more)

### Community 6 - "UI Component Aliases & System"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 7 - "Node TypeScript Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "Agent Rules & QA Browser Testing"
Cohesion: 0.33
Nodes (6): Testing Viewport Matrix, Vivid QA Checklist, UI Browser Testing Skill, Main Agent Orchestrator Instructions, Git Push Restriction Rule, Mobile & Tablet Responsiveness Rule

### Community 15 - "Security Audit & RLS Policies"
Cohesion: 0.40
Nodes (5): Security Audit Checklist, Security Rules, Security Audit Skill, Input Validation & Injection Rules, Supabase & Auth Security Rules

## Knowledge Gaps
- **126 isolated node(s):** `CompactBillPayload`, `SyncConfig`, `AdminPanelProps`, `Props`, `State` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 149 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `POS Billing Views & Modals` to `Core Dependencies & Packages`, `BillShare & Receipt Components`, `Admin Panel & Database Operations`, `Shop Context & Settings Management`, `Application Entrypoint & Error Boundary`, `Supabase Authentication & Services`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `POS Billing Views & Modals` to `Core Dependencies & Packages`, `BillShare & Receipt Components`, `Admin Panel & Database Operations`, `Shop Context & Settings Management`, `Application Entrypoint & Error Boundary`, `Supabase Authentication & Services`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `CompactBillPayload`, `SyncConfig`, `AdminPanelProps` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BillShare & Receipt Components` be split into smaller, more focused modules?**
  _Cohesion score 0.09390243902439024 - nodes in this community are weakly interconnected._
- **Should `Application Entrypoint & Error Boundary` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Core Dependencies & Packages` be split into smaller, more focused modules?**
  _Cohesion score 0.045328399629972246 - nodes in this community are weakly interconnected._
- **Should `App TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._