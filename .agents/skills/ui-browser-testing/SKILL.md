---
name: ui-browser-testing
description: >-
  Procedure and guidelines for Vivid, the browser-based UI inspection subagent, to test
  interactive clicking, scrolling, keypad testing, and mobile/tablet responsiveness on DigiBill POS.
---

# UI Browser Testing & Exploration Guide (Vivid) — DigiBill POS

This skill provides step-by-step procedures for **Vivid**, the autonomous browser QA subagent, to perform automated and interactive testing on the DigiBill web application.

---

## 1. Application Architecture & Key Views

| Surface | Component | Key Interactions to Test |
| :--- | :--- | :--- |
| **Authentication** | `src/components/AuthScreen.tsx` | Login / Register toggle, PAN input, validation alerts, password toggle, close button. |
| **Keypad Billing** | `src/App.tsx` (`mode === 'simple'`) | Number pad clicks (0-9, 00, C, ⌫), amount formatting, Tax/Discount toggles, Generate Bill action. |
| **Itemized Billing** | `src/App.tsx` (`mode === 'itemized'`) | Catalog search, category filter, adding items to basket, (+ / -) quantity controls, clearing basket. |
| **Receipt Modal** | `src/App.tsx` | QR code display, WhatsApp / SMS share buttons, Print / Download actions, modal dismiss. |
| **Past Invoices** | `src/App.tsx` (History Drawer) | Searching bills by invoice number or date, vertical scrolling, bill detail sheet popup. |
| **Shop Settings** | `src/App.tsx` (Settings Drawer) | Editing shop name, PAN, starting bill number, Sign Out / Switch account button. |

---

## 2. Testing Viewport Matrix

All UI components must be validated across the following responsive widths (as mandated by `AGENTS.md`):

- **Mobile Viewports**:
  - `375 x 667` (iPhone SE)
  - `390 x 844` (iPhone 14/15)
  - `430 x 932` (iPhone Pro Max)
- **Tablet Viewports**:
  - `768 x 1024` (iPad Mini / Portrait)
  - `820 x 1180` (iPad Air)
  - `1024 x 768` (iPad Landscape)

---

## 3. Step-by-Step QA Checklist for Vivid

### A. Keypad & Input Controls
1. Click keypad buttons `1`, `2`, `3`, `0`, `00` $\rightarrow$ verify display updates correctly without jumping.
2. Click `C` (Clear) and `⌫` (Backspace) $\rightarrow$ verify value resets smoothly.
3. Test decimal / currency formatting (NPR standard).

### B. Scrolling & Layout Integrity
1. In Itemized Mode with $>10$ catalog items $\rightarrow$ verify vertical scroll is smooth and does not push bottom navigation off-screen.
2. In Past Bills Drawer $\rightarrow$ scroll through transaction history without layout shifting.
3. Ensure no unwanted horizontal scrollbars appear on mobile viewports.

### C. Touch & Click Targets
1. Ensure all action buttons (Generate Bill, Basket Controls, Keypad digits) have a minimum touch target size of **$44 \times 44\text{px}$**.
2. Verify active-state micro-animations (`active:scale-95`).

### D. Console & Runtime Errors
1. Check browser console logs for unhandled exceptions, hydration issues, or React warnings during interactions.
