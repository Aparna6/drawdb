## Summary

Adds an **Auto arrange** control that repositions all tables on the canvas into a consistent two-row layout. This helps reduce visual clutter and can minimize relationship line crossings when tables are spread randomly. The action is **undoable** via the existing Undo/Redo buttons.

## Motivation

- Users often drag tables manually, which can lead to overlapping or hard-to-follow diagrams.
- A one-click layout option gives a predictable starting layout and can make relationship lines easier to follow.
- Aligns with the product goal of minimizing line crossings and improving diagram readability.

## Changes

### 1. **Toolbar button**
- **Location:** Editor header toolbar, between **Add note** and the **Save** button (with the vertical divider).
- **Icon:** Sitemap icon (`fa-sitemap`).
- **Tooltip:** “Auto arrange layout” (localized via `auto_arrange_layout` in `en.js`).
- **Behavior:** Disabled when the diagram is read-only or when there are no tables; otherwise applies the layout and pushes one undo step.

### 2. **Layout algorithm**
- Reuses the existing **`arrangeTables()`** in `src/utils/arrangeTables.js`:
  - First half of tables → **top row** (left to right).
  - Second half → **bottom row** (left to right), aligned under the top row.
  - Uses fixed `tableWidth` (200px), `gapX` (54px), and `gapY` (40px); row height is derived from the tallest table in the top row.
- No new algorithm (e.g. force-directed or layered) in this PR; the current two-row layout is exposed in the UI and wired to undo.

### 3. **Undo/Redo**
- One **bulk move** undo entry is pushed for the whole auto-arrange (same pattern as multi-select drag).
- **Undo** restores all table positions to their pre–auto-arrange state; **Redo** reapplies the arranged positions.

### 4. **Files touched**
- `src/components/EditorHeader/ControlPanel.jsx`  
  - Import `arrangeTables`.  
  - Add `autoArrangeLayout()` (copy tables → run `arrangeTables` → push bulk MOVE undo → `setTables`).  
  - Add toolbar button with tooltip and disabled logic.
- `src/i18n/locales/en.js`  
  - Add `auto_arrange_layout: "Auto arrange layout"`.

## How to test

1. Open a diagram that has at least two tables (with or without relationships).
2. Move some tables so the layout is clearly “messy” or overlapping.
3. In the header toolbar, find the **sitemap** icon between Add note and Save.
4. Hover to see the “Auto arrange layout” tooltip.
5. Click the button: all tables should snap to the two-row layout.
6. Click **Undo**: tables should return to their previous positions.
7. Click **Redo**: tables should go back to the arranged layout.
8. In read-only mode (or with zero tables), the button should be disabled.

---

*End of PR description*
