# Prompt for Gemini: Implement Zoho Sheets–style Sparkline Feature

Copy everything below into Gemini as your prompt.

---

I want to add a **Sparkline** feature to my spreadsheet project that replicates the exact functionality of Zoho Sheets' sparkline tool. Please implement this fully, including the insert dialog, the settings panel, and all sub-options described below. Treat this as a complete functional specification — implement every option, not just a subset.

## 1. Insert Sparkline Dialog

When the user triggers "Insert Sparkline" (menu action or toolbar icon):

- Show a modal titled **"Insert Sparklines"** with two inputs:
  - **Source**: a range reference (e.g. `'Sheet1'.C147`) — user can type it or click a small grid icon to select the range on the sheet.
  - **Destination**: a range reference where the sparklines will be drawn — also has a grid-picker icon.
- Below the inputs, show a note: **"Please select a destination range that is equal to the source range."** — i.e. destination range dimensions (rows × columns) must match the source range dimensions exactly. Validate this before allowing submit.
- Buttons: **OK** (primary/green) and **Cancel**.
- On OK: create one sparkline per row/column pair mapping source → destination cell, grouped together as a single "sparkline group" (so later formatting changes can apply to the whole group at once, similar to how Excel/Zoho treat sparkline groups).

## 2. Sparkline Settings Panel (right-side panel, opened after insert or when a sparkline cell is selected)

The panel has a header:
- Title: **"Sparkline"**
- A close (X) icon top-right
- Below title: **"Source: '<SheetName>'.<CellRef>"** with an **Edit** link (green text) next to it that reopens the source/destination edit dialog (see section 8).

The panel body is a scrollable list of sections, in this order:

### 2.1 Sparkline Type
Three icon buttons in a row representing chart type, plus a color swatch dropdown to their right:
1. **Line** – line sparkline
2. **Bar** (column-style) – bar/column sparkline
3. **Win/Loss** – shows tooltip "Win/Loss" on hover; renders each data point as a fixed-height up (win/positive) or down (loss/negative) block instead of proportional bars.
4. Next to the three type icons: a **color swatch dropdown** — this sets the default/base color of the sparkline (the line color, or bar fill color, or win/loss "win" color depending on type). Clicking it opens the shared Color Picker (see section 7).

Only one type can be active at a time (radio-button-like behavior, shown as a highlighted/selected icon).

### 2.2 Highlight Points
Two columns of checkbox + label + color-swatch-dropdown rows:

Left column:
- **High** — highlights the highest value point (default color: green)
- **First** — highlights the first data point (default color: blue)
- **Negative** — highlights negative-value points (default color: red)

Right column:
- **Low** — highlights the lowest value point (default color: orange)
- **Last** — highlights the last data point (default color: blue)
- **Markers** — shows a marker dot on every data point (default color: blue), only meaningful/enabled for Line sparkline type.

Each row: a checkbox to enable/disable that highlight, the label, and its own independent color-swatch dropdown (opens the same shared Color Picker from section 7) so each highlight type can have its own custom color.

Behavior notes:
- Multiple highlight options can be checked simultaneously (not mutually exclusive).
- If a point qualifies for more than one highlight (e.g., it's both the High point and the Last point), the highlight color priority should follow a sensible precedence (e.g., Negative > High/Low > First/Last > Markers) — implement a reasonable, consistent rule and document it in code comments.
- "Markers" and "Negative"/"Win-Loss" specific options should gray out or be irrelevant depending on selected Sparkline Type (e.g., Markers only applies meaningfully to Line type; Win/Loss type uses High/Negative as "Win"/"Loss" coloring rather than literal high/low value).

### 2.3 Show Empty Cells
A row of 4 toggle buttons (single-select, one always active):
- **Gap** — empty cells are skipped, leaving a visual gap in the sparkline.
- **Zero** — empty cells are treated as 0.
- **Connect** — empty cells are ignored and the line connects directly across them (only meaningful for Line type).
- **Skip** — empty cells are skipped entirely, not counted as part of the series.
(Implement the real distinction between "Gap" and "Skip": Gap leaves a visible break in a line sparkline; Skip removes the point from the data series so neighboring points connect as if it didn't exist. Connect explicitly bridges the gap with a continuous line.)

### 2.4 Include Hidden Rows and Columns
A single checkbox: **"Include hidden rows and columns"** — when checked, sparkline calculation includes data from hidden rows/columns in the source range; when unchecked, hidden data is excluded from the sparkline rendering.

### 2.5 Manage Settings
Two buttons side by side:
- **Group** (with a dropdown chevron) — group management options such as "Group", "Ungroup" for combining/separating sparklines into a shared-settings group.
- **Delete** (with a dropdown chevron) — delete options such as "Delete Selected Sparkline(s)" or "Delete Sparkline Group".

Below these, a full-width button:
- **Switch rows / columns** — transposes how the source data is read (treats rows as series vs columns as series), useful when sparkline data orientation needs to flip without re-selecting the range.

### 2.6 Horizontal Axis (collapsible section, chevron to expand/collapse)
When expanded, shows:
- **Display Axis** (checkbox) — draws a horizontal zero-axis line through the sparkline when the data crosses zero.
- **Plot sparkline from right to left** (checkbox) — reverses the horizontal plotting direction of the data series.

### 2.7 Vertical Axis (collapsible section, chevron to expand/collapse)
When expanded, shows two grouped radio-button sets:

**Minimum Value:**
- **Automatic for each sparkline** (default, selected) — each sparkline's Y-axis minimum is computed independently from its own data.
- **Same for all sparklines** — all sparklines in the group share one computed minimum (the lowest value across all of them).
- **Custom value:** — a text/number input appears allowing the user to type an explicit minimum value applied to all sparklines in the group.

**Maximum Value:**
- **Automatic for each sparkline** (default, selected)
- **Same for all sparklines**
- **Custom value:** — text/number input for an explicit maximum.

These settings control the Y-axis scale independently from the X-axis behavior in section 2.6.

## 3. Panel Layout Behavior
- Sections 2.6 and 2.7 (Horizontal Axis / Vertical Axis) are collapsed by default and expand in place when clicked, pushing content below them down (accordion style, not a modal).
- The whole panel is scrollable vertically; a scrollbar appears when content overflows the visible panel height.
- The panel stays open and live-updates the sparkline rendering on the sheet as each option is changed (no separate "Apply" button needed except in the Edit Source/Destination dialog).

## 4. Sparkline Rendering Rules
Implement actual rendering logic per type:
- **Line**: connects data points with a line in the selected base color; respects Markers, High/Low/First/Last/Negative highlight dots on top of the line; respects empty-cell handling mode.
- **Bar**: draws vertical bars per data point scaled to the local min/max (or group min/max per Vertical Axis settings); positive/negative bars can extend above/below a zero baseline if values include negatives; highlight colors override the base bar color for qualifying points (e.g., the bar for the max value renders in the "High" color if enabled).
- **Win/Loss**: ignores actual magnitude — every data point renders as a same-height up-block (win/positive) or down-block (loss/negative or zero-or-below), colored by the High(win)/Negative(loss) highlight colors if enabled, otherwise a default win/loss color pair.

## 5. Data Model / State per Sparkline Group
Each sparkline (or sparkline group) should store this configuration object, e.g.:

```json
{
  "sourceRange": "Sheet1!C2:C10",
  "destinationRange": "Sheet1!D2:D10",
  "type": "line", // "line" | "bar" | "winloss"
  "baseColor": "#4A86E8",
  "highlights": {
    "high":     { "enabled": true,  "color": "#34A853" },
    "low":      { "enabled": false, "color": "#F4B400" },
    "first":    { "enabled": false, "color": "#4A86E8" },
    "last":     { "enabled": false, "color": "#7BAAF7" },
    "negative": { "enabled": false, "color": "#EA4335" },
    "markers":  { "enabled": false, "color": "#4A86E8" }
  },
  "emptyCellMode": "gap", // "gap" | "zero" | "connect" | "skip"
  "includeHiddenRowsColumns": false,
  "horizontalAxis": {
    "displayAxis": false,
    "rightToLeft": false
  },
  "verticalAxis": {
    "min": { "mode": "auto" /* "auto" | "same" | "custom" */, "customValue": null },
    "max": { "mode": "auto", "customValue": null }
  },
  "isGrouped": true,
  "groupId": "sparkgroup_1"
}
```

Persist this per sparkline/group so settings survive reload, and re-render whenever the underlying source data changes (sparklines are "live" — they must recompute automatically whenever a cell in the source range is edited).

## 6. Edit Source/Destination Dialog
Triggered by the **Edit** link in the panel header. Modal titled **"Edit"** with two tabs: **Selected** / **Group** (choosing whether the edit applies to just the one selected sparkline cell or the entire group it belongs to). Fields:
- **Source** (range reference, editable, blue link-style text)
- **Destination** (range reference, editable, blue link-style text)
- **OK** (green) / **Cancel** buttons.
Changing source/destination here re-binds the sparkline(s) to new ranges without recreating them, preserving all style settings.

## 7. Shared Color Picker Component
Used by every color-swatch dropdown in the panel (base color, and each highlight's color). It should be a single reusable popover with:
- **Theme Colors**: a grid of preset theme colors organized in rows (grayscale row + several color rows with light-to-dark shading per hue).
- **Standard Colors**: one row of standard/basic colors (red, orange, yellow, green, teal/green, blue variants, purple).
- **Other Used Colors**: dynamically shows colors the user has recently applied elsewhere in this sparkline/document, so they can quickly reuse them.
- **More Colors** (with a `>` chevron): opens a full custom color picker (hex input / RGB sliders / eyedropper) for any arbitrary color.
- Currently-selected color is visually indicated (e.g., a border/checkmark on the selected swatch).
- Clicking any swatch immediately applies that color to whichever element (base sparkline color or specific highlight) opened the picker, and closes the popover.

## 8. Implementation Notes
- Build this as reusable, modular components: `SparklineInsertDialog`, `SparklinePanel`, `ColorPickerPopover`, `SparklineRenderer` (handles actual line/bar/winloss drawing, e.g. via SVG or Canvas).
- Sparkline rendering should scale to fit the destination cell(s) exactly, similar to an inline chart embedded in a cell.
- All settings changes should be reactive/live — update the rendered sparkline immediately, no "Apply" step except where explicitly noted (Edit Source/Destination dialog uses OK to commit).
- Make sure Gap vs Skip vs Zero vs Connect are functionally distinct in the calculation, not just labeled differently.
- Respect group vs individual editing: if multiple sparklines are grouped, changing one setting in the panel should apply to the whole group unless the user is specifically editing via the "Selected" tab in the Edit dialog.

Please implement this as a complete, working feature in my project (ask me for my current tech stack/file structure if you need it before writing code), matching this behavior exactly.
