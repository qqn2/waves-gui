# Agent-QC: Browser Testing Pre-Prompt & Comprehensive Test Suite

## Part 1 — Sub-Agent Pre-Prompt

```
You are a Quality Control (QC) Tester agent for the WaveDrom GUI Editor (a browser-based timing diagram editor for hardware engineers). Your job is to systematically execute each test case below inside a real browser and report results.

### Setup
1. The dev server should already be running at http://localhost:5173. If not, run `cd /home/rek/projects/waves-gui && npm run dev` and wait for it.
2. Navigate to http://localhost:5173 in the browser.
3. The app has: a top toolbar, a left signal panel, a central canvas, and optional right-side JSON/Render panels.

### How to Test
- Execute each numbered test case step-by-step.
- After each action, take a screenshot or read the DOM to verify the expected result.
- Check the browser console for errors/warnings after significant actions.
- For canvas interactions: the canvas fills the central area. Signal rows are ~40px tall. Time-step columns are ~40px wide. Row 0 starts at the top of the canvas. Coordinate (col * 40 + 20, row * 40 + 20) targets the center of a cell.
- For toolbar buttons: identify them by their title attribute, visible text, or aria-label.

### Reporting
Return a summary table:
| Test ID | Name | Status | Notes |
With Status = PASS, FAIL, or BLOCKED. For failures, include the symptom and any console errors.
```

---

## Part 2 — Test Suite

### Section A: Application Startup & Layout

**TC-A01: Initial page load**
1. Navigate to `http://localhost:5173`.
2. Verify: toolbar visible at top, signal panel on left, canvas in center, status bar at bottom. No console errors.

**TC-A02: Default diagram content**
1. On fresh load, verify default signals exist in the signal panel (rows with BIT/BUS badges).
2. Verify the canvas renders waveforms (not blank).

**TC-A03: Status bar info**
1. Check the status bar shows signal count, step count, zoom %, and tool name.

---

### Section B: Theme & Appearance

**TC-B01: Switch base theme**
1. Click `Theme ▾` in toolbar. Select `Light grey`. Verify background color changes.
2. Switch back to `Light`. Verify it reverts.

**TC-B02: Change accent color**
1. Open Theme menu. Click the Teal accent swatch. Verify accent-colored UI elements change.
2. Click `Reset`. Verify accent reverts to default blue.

**TC-B03: Change canvas background**
1. Open Theme menu. Click the `Warm` canvas swatch. Verify canvas background tint changes.
2. Click `Theme default` to reset.

**TC-B04: Change text size**
1. Open Theme menu. Click `S` (small) text size. Verify UI text shrinks.
2. Click `M` to reset to medium.

**TC-B05: Custom accent via color picker**
1. Open Theme menu. Use the custom accent color input to pick a red (#e11d48). Verify accent changes.

---

### Section C: Signal Management

**TC-C01: Add a bit signal**
1. Click `+ Add signal ▾` dropdown. Click the bit option. Verify a new row with `BIT` badge appears in the signal panel and a new lane on the canvas.

**TC-C02: Add a bus (vector) signal**
1. Click `+ Add signal ▾`. Click the bus/vector option. Verify a new row with `BUS` badge appears.

**TC-C03: Add a spacer**
1. Click `+ Add signal ▾`. Click the spacer option. Verify a blank row with `—` badge appears.

**TC-C04: Add a group (section)**
1. Click `+ Add signal ▾`. Click the group/section option. Verify a collapsible group header row appears.

**TC-C05: Rename signal by double-click**
1. Double-click on a signal name in the left panel. An inline text editor should appear.
2. Type `my_clk` and press Enter. Verify the name updates to `my_clk`.

**TC-C06: Rename signal — cancel with Escape**
1. Double-click a signal name. Type something. Press Escape. Verify the original name is kept.

**TC-C07: Delete signal via context menu**
1. Right-click a signal row. Click `Delete`. Verify the signal is removed from panel and canvas.

**TC-C08: Duplicate signal**
1. Right-click a signal row. Click `Duplicate`. Verify a copy appears (or note if the feature is disabled/unimplemented).

**TC-C09: Context menu — Add bit above**
1. Right-click a signal. Click `Add bit above`. Verify a new BIT signal is inserted above.

**TC-C10: Context menu — Add bus below**
1. Right-click a signal. Click `Add bus below`. Verify a new BUS signal is inserted below.

**TC-C11: Context menu — Set all to 0**
1. Right-click a BIT signal. Click `Set all to 0`. Verify all steps show low (0).

**TC-C12: Context menu — Set all to 1**
1. Right-click a BIT signal. Click `Set all to 1`. Verify all steps show high (1).

**TC-C13: Move signal to group**
1. Ensure a group exists. Right-click a signal outside the group. Under `Move to section`, select the group. Verify the signal moves inside the group.

**TC-C14: Remove signal from group**
1. Right-click a signal inside a group. Click `Remove from section`. Verify it moves to the top level.

**TC-C15: Collapse and expand group**
1. Click on a group header row to collapse it. Verify child signals are hidden.
2. Click again to expand. Verify children reappear.

**TC-C16: Signal reorder via drag-and-drop**
1. Ensure 3+ signals exist. Drag one signal's handle from bottom to top. Verify order updates in panel and canvas.

---

### Section D: Paint Tool — Bit Signals

**TC-D01: Paint high (1)**
1. Select paint tool (brush icon or press `D`). Select value `1`.
2. Click-drag across a BIT signal row on the canvas (e.g., steps 0–4).
3. Verify waveform shows high for those steps. Check JSON panel `wave` string updated.

**TC-D02: Paint low (0)**
1. Select value `0`. Paint across steps 2–5 on a BIT signal.
2. Verify waveform shows low. Verify JSON.

**TC-D03: Paint unknown (x)**
1. Select value `x` (or press `X`). Paint a range. Verify hatched/X rendering on canvas.

**TC-D04: Paint high-impedance (z)**
1. Select value `z` (or press `Z`). Paint a range. Verify Z rendering (dashed mid-line).

**TC-D05: Paint clock positive edge (p)**
1. Click `More ▾` to expand extra values. Select `p`. Paint a range.
2. Verify clock waveform with rising edges renders.

**TC-D06: Paint clock negative edge (n)**
1. Select `n`. Paint a range. Verify falling-edge clock renders.

**TC-D07: Paint clock P (with arrow)**
1. Select `P` from primary values (or press `P`). Paint a range.
2. Verify clock with arrow glyph renders on the rising edge.

**TC-D08: Paint clock N (with arrow)**
1. Select `N` (or press `N`). Paint a range. Verify clock with arrow on falling edge.

**TC-D09: Paint weak pull-up (u)**
1. Expand `More ▾`. Select `u`. Paint a range. Verify dashed/lighter high rendering.

**TC-D10: Paint weak pull-down (d)**
1. Select `d`. Paint a range. Verify dashed/lighter low rendering.

**TC-D11: Paint continuation (.)**
1. Select `.` from More menu. Paint a range. Verify waveform holds previous level.

**TC-D12: Toggle (NOT) mode**
1. Click `¬` (toggle) button (or press `T`). Paint over a bit signal with mixed 0/1.
2. Verify 0→1 and 1→0 toggling. Verify p↔n and P↔N toggling.

**TC-D13: Glitch mode**
1. Click `⌢` (glitch) button (or press `G`). Click on a step boundary.
2. Verify a spurious transition (glitch marker) appears between steps.

**TC-D14: Paint single cell click**
1. With paint tool, click (don't drag) on a single cell. Verify only that one cell changes.

**TC-D15: Paint mode persists across drags**
1. Set value to `1`, drag to paint. Release. Drag on a different row. Verify value `1` is still applied.

---

### Section E: Paint Tool — Bus/Vector Signals

**TC-E01: Paint bus segment**
1. Select paint tool. Type a label in the `Bus` text input (e.g., `ADDR`).
2. Click-drag across a BUS signal row on the canvas. Verify a colored segment with label `ADDR` appears.

**TC-E02: Paint bus with different color**
1. Click a different color swatch in the bus color palette (colors 2–9).
2. Paint a new range on a bus row. Verify the segment uses the selected color.

**TC-E03: Paint adjacent bus segments**
1. Paint `ADDR` on steps 0–3, then paint `DATA` on steps 4–7.
2. Verify two distinct segments render side-by-side with correct labels.

**TC-E04: Overwrite existing bus segment**
1. Paint a segment on steps 0–5 with label `A`. Then paint steps 2–3 with label `B`.
2. Verify the original segment is split/overwritten correctly.

---

### Section F: Bus Segment Editor (Panel)

**TC-F01: Open segment editor**
1. Click on a BUS signal row in the left panel to select it.
2. Verify the `Bus labels` segment editor appears below the signal list.

**TC-F02: Edit segment label**
1. In the segment editor, change a segment's text input (e.g., to `0xFF`). Press Enter or blur.
2. Verify the canvas and JSON update with the new label.

**TC-F03: Change segment color via editor**
1. Click a different color swatch in a segment row of the editor.
2. Verify the segment color changes on the canvas.

**TC-F04: Segment range display**
1. Verify each segment row shows its step range (e.g., `[0, 4)`).

---

### Section G: Erase Tool

**TC-G01: Erase bit signal range**
1. Select the eraser tool (or press `E`). Drag across a painted BIT row.
2. Verify the states are cleared (continuation `.`). Verify JSON updates.

**TC-G02: Erase bus segment**
1. With eraser, drag across a BUS segment. Verify the segment is removed or cleared.

**TC-G03: Erase single cell**
1. Click (don't drag) on a single painted cell with the eraser. Verify only that cell is erased.

---

### Section H: Pointer / Select Tool

**TC-H01: Click to select signal**
1. Select pointer tool (or press `V`). Click on a signal lane in the canvas.
2. Verify the signal is highlighted/selected in the left panel.

**TC-H02: Drag to area-select**
1. With pointer tool, click and drag a rectangle over multiple signals and steps.
2. Verify a selection overlay appears. Release and verify multiple signals are selected.

**TC-H03: Ctrl+A select all**
1. Press `Ctrl+A`. Verify all signals are selected (highlighted in panel).

**TC-H04: Delete selection (clear steps)**
1. Select a signal and a step range. Press `Delete` or `Backspace`.
2. Verify the selected steps are cleared to default state.

**TC-H05: Delete selection (remove row)**
1. Select a signal (full row, no step range). Press `Delete`.
2. Verify a confirmation dialog appears. Confirm. Verify signal is removed.

**TC-H06: Escape cancels selection**
1. Make a selection. Press `Escape`. Verify selection is cleared.

---

### Section I: Edge / Arrow Tool

**TC-I01: Place a dependency arrow**
1. Select arrow tool (arrow icon). Toggle `ABC` anchor letters on.
2. Click on signal A at step 2. Move to signal B at step 4. Click.
3. Verify an arrow is drawn. Verify `edge` array in JSON has a new entry.

**TC-I02: Change arrow edge shape**
1. With arrow tool active, change the `shape` dropdown (e.g., to `~` for spline).
2. Place a new arrow. Verify the arrow uses the curved shape.

**TC-I03: Try all edge shapes**
1. Place arrows using each shape: `→`, `-`, `-~`, `~`, `-|`, `|-`, `-|-`.
2. Verify each renders with a distinct path style.

**TC-I04: Edit edge in status bar**
1. After placing an edge, locate it in the status bar chip list.
2. Click the edge chip text. Verify an inline editor opens. Change the text. Blur. Verify JSON updates.

**TC-I05: Delete edge from status bar**
1. Click the `×` button on an edge chip. Verify the edge is removed from canvas and JSON.

**TC-I06: Toggle anchor letters (ABC)**
1. Click the `ABC` button. Verify letter badges (A, B, C...) appear on waveform nodes.
2. Toggle off. Verify letters disappear.

---

### Section J: Timespan Tool

**TC-J01: Place a timespan**
1. Select timespan tool (double-headed arrow icon).
2. Type a label in the `Span` input (e.g., `5 ns`).
3. Click on a signal at step 1, then click at step 5 on the same row.
4. Verify a timespan band with label `5 ns` renders. Verify `edge` array in JSON.

**TC-J02: Timespan with empty label**
1. Clear the `Span` label input. Place a timespan. Verify it still renders (no label or empty).

---

### Section K: Undo / Redo

**TC-K01: Undo paint**
1. Paint some cells. Click `Undo`. Verify the paint is reverted.

**TC-K02: Redo after undo**
1. After undo, click `Redo`. Verify the paint reappears.

**TC-K03: Ctrl+Z / Ctrl+Y shortcuts**
1. Make a change. Press `Ctrl+Z`. Verify undo. Press `Ctrl+Y`. Verify redo.

**TC-K04: Undo add signal**
1. Add a signal. Undo. Verify it disappears.

**TC-K05: Undo delete signal**
1. Delete a signal. Undo. Verify it reappears.

**TC-K06: Undo step count change**
1. Change totalSteps. Undo. Verify step count reverts.

---

### Section L: Zoom & Scroll

**TC-L01: Zoom in**
1. Click zoom-in button (or `Ctrl++`). Verify zoom % increases and canvas cells appear larger.

**TC-L02: Zoom out**
1. Click zoom-out button (or `Ctrl+-`). Verify zoom % decreases.

**TC-L03: Zoom reset**
1. Press `Ctrl+0`. Verify zoom resets to 100%.

**TC-L04: Scroll canvas**
1. Use mouse wheel to scroll the canvas vertically and horizontally. Verify canvas pans. Verify signal panel scrolls in sync vertically.

---

### Section M: Hscale (Horizontal Scale)

**TC-M01: Change hscale**
1. In the toolbar, change `hscale` input to `2`. Verify waveform columns are twice as wide.

**TC-M02: Fractional hscale**
1. Set hscale to `1.5`. Verify columns are 1.5× wide. Verify JSON `config.hscale` = 1.5.

**TC-M03: Hscale clamping**
1. Try setting hscale to `0.5` (below min). Verify it clamps to `1`.
2. Try `10` (above max). Verify it clamps to `4`.

---

### Section N: Diagram Steps (Timeline Length)

**TC-N01: Increase steps via + button**
1. Click `+` on the Steps control. Verify step count increments and canvas extends.

**TC-N02: Decrease steps via − button**
1. Click `−`. Verify step count decrements and canvas shrinks.

**TC-N03: Type step count directly**
1. Clear the Steps input. Type `16`. Verify canvas has 16 columns.

**TC-N04: Minimum/maximum clamping**
1. Try setting steps to `0`. Verify it clamps to `1`.
2. Try `999`. Verify it clamps to `512`.

---

### Section O: Head / Foot / Title / Caption

**TC-O01: Set diagram title**
1. Type `SPI Transfer` into the `Title` input. Verify title renders at top of canvas.

**TC-O02: Set diagram caption**
1. Type `Figure 1` into the `Caption` input. Verify caption renders at bottom.

**TC-O03: Clear title**
1. Clear the Title input. Verify the title disappears from canvas.

**TC-O04: Advanced — tick labels**
1. Click `Advanced ▸` to expand. Set `tick` = `0`, `every↑` = `1`.
2. Verify numbered labels (0, 1, 2, 3...) appear at the top of the waveform.

**TC-O05: Advanced — tock labels**
1. Set `tock` = `0`, `every↓` = `2`. Verify bottom labels show (0, 2, 4, 6...).

**TC-O06: Clear tick/tock**
1. Clear all advanced fields. Verify scale labels disappear.

---

### Section P: Period & Phase (Per-Signal Timing)

**TC-P01: Select signal shows timing bar**
1. Click a single BIT signal in the left panel. Verify the timing bar with `phase` and `period` inputs appears.

**TC-P02: Set period**
1. Type `2` into `period`. Verify the waveform for that lane stretches (2× wider cycles).

**TC-P03: Set phase**
1. Type `0.5` into `phase`. Verify the waveform shifts right by half a step.

**TC-P04: Clear period**
1. Click `×` next to period. Verify waveform resets to default width.

**TC-P05: Clear phase**
1. Click `×` next to phase. Verify waveform resets to no shift.

**TC-P06: Period + phase combined**
1. Set period=2 and phase=0.25. Verify both effects apply simultaneously.

---

### Section Q: JSON Code Panel

**TC-Q01: Toggle JSON panel**
1. Click `JSON` in toolbar. Verify panel shows/hides.

**TC-Q02: Edit JSON — change wave string**
1. In JSON editor, change a signal's `wave` from `"010101"` to `"111000"`.
2. Click outside the editor (blur). Verify the canvas updates to match.

**TC-Q03: Edit JSON — rename signal**
1. Change a signal's `name` in JSON. Blur. Verify the left panel label updates.

**TC-Q04: Edit JSON — add a new signal object**
1. Manually add `{"name":"new_sig","wave":"10101010"}` to the `signal` array in JSON.
2. Blur. Verify a new signal appears on canvas and in the panel.

**TC-Q05: Invalid JSON — missing bracket**
1. Delete a `}` to make invalid JSON. Verify the editor shows an error indicator. Verify canvas does not crash.

**TC-Q06: Invalid JSON — recovery**
1. Fix the JSON (restore the bracket). Blur. Verify the canvas recovers.

**TC-Q07: Copy button**
1. Click `Copy` in the code panel toolbar. Verify clipboard contains current JSON (or at minimum, no error occurs).

**TC-Q08: Web button**
1. Click `Web`. Verify a new tab/window opens to `wavedrom.com/editor.html` with encoded JSON in URL.

---

### Section R: WaveDrom Render Preview

**TC-R01: Toggle render panel**
1. Click `Render` in toolbar. Verify the WaveDrom SVG preview panel shows/hides.

**TC-R02: Preview matches diagram**
1. With render panel visible, verify the WaveDrom-rendered SVG closely matches the canvas waveforms.

**TC-R03: Preview updates on edit**
1. Paint a change on the canvas. Verify the render preview updates to reflect it.

---

### Section S: File Operations

**TC-S01: Load sample — Clock and reset**
1. Click `File ▾` → `Clock and reset` sample. Verify the diagram loads with clock, reset, and enable signals.

**TC-S02: Load sample — Handshake**
1. File → `Handshake`. Verify req/gnt/valid/ready signals load.

**TC-S03: Load sample — Address/data bus**
1. File → `Address / data bus`. Verify vector lanes with data labels load.

**TC-S04: Load sample — Grouped signals**
1. File → `Grouped signals`. Verify nested groups and spacer rows render.

**TC-S05: Load sample — X/Z/U/D states**
1. File → `X / Z / U / D`. Verify special state rendering (unknown, hi-Z, weak pull-up/down).

**TC-S06: Load AMBA sample — APB write**
1. File → `APB write`. Verify AMBA APB timing diagram loads correctly.

**TC-S07: Load AMBA sample — AXI4 write**
1. File → `AXI4 write`. Verify AXI channels render with bus labels.

**TC-S08: File → New**
1. Make changes to a diagram. Click File → `New`. Verify a discard confirmation appears (if dirty). Confirm. Verify diagram resets to blank/default.

**TC-S09: Export dialog opens**
1. Click File → `Export…`. Verify the Export Dialog modal appears with format selector.

**TC-S10: Export as PNG**
1. In Export dialog, select PNG, scale 1×. Click `Export`. Verify a file downloads (or no error).

**TC-S11: Export as SVG**
1. Select SVG. Export. Verify file downloads.

**TC-S12: Export as JPG**
1. Select JPG, scale 2×. Export. Verify file downloads.

**TC-S13: Export as WaveDrom JSON**
1. Select `WaveDrom JSON`. Export. Verify a `.json` file downloads.

**TC-S14: Export dialog — cancel**
1. Open export dialog. Click `Cancel`. Verify dialog closes without exporting.

**TC-S15: Export dialog — click backdrop**
1. Open export dialog. Click on the dark backdrop area. Verify dialog closes.

---

### Section T: Patterns Menu

**TC-T01: Insert clock pattern**
1. Open patterns menu (if accessible from + Add signal or toolbar). Select `Clock` pattern.
2. Verify a clock signal is added with alternating p/n waveform.

**TC-T02: Insert reset pattern**
1. Select `Reset` pattern. Verify a signal with asserted-then-deasserted waveform appears.

**TC-T03: Insert counter pattern (bus)**
1. Select `Counter` pattern. Verify a BUS signal with incrementing hex labels appears.

**TC-T04: Insert pulse pattern**
1. Select `Pulse`. Verify single pulse waveform.

**TC-T05: Insert PWM pattern**
1. Select `PWM`. Verify repeating duty-cycle waveform.

**TC-T06: Insert strobe pattern**
1. Select `Strobe`. Verify periodic enable pulse.

**TC-T07: Insert alternating pattern**
1. Select `Alternating`. Verify simple 0/1/0/1 pattern.

**TC-T08: Insert walking-1 pattern**
1. Select `Walking 1`. Verify single-bit scan pattern.

**TC-T09: Insert walking-0 pattern**
1. Select `Walking 0`. Verify inverted walking-one.

**TC-T10: Insert Gray code pattern (bus)**
1. Select `Gray code`. Verify bus with Gray code labels.

**TC-T11: Insert bus idle pattern**
1. Select `Bus idle`. Verify constant `IDLE` label bus.

**TC-T12: Pattern with custom parameters**
1. Open a pattern (e.g., Clock). Change `Period` to 4. Apply. Verify the clock has 4-step period.

---

### Section U: Keyboard Shortcuts

**TC-U01: D → paint tool**
1. Press `D`. Verify paint tool activates.

**TC-U02: E → erase tool**
1. Press `E`. Verify erase tool activates.

**TC-U03: V → pointer tool**
1. Press `V`. Verify pointer/cursor tool activates.

**TC-U04: 1/0/P/N/Z/X → primary paint values**
1. With paint tool active, press `1`. Verify active bit state is `1`.
2. Press `0`. Verify `0`. Press `X`. Verify `x`. Press `Z`. Verify `z`.

**TC-U05: T → toggle mode**
1. Press `T`. Verify paint mode switches to toggle (¬).

**TC-U06: G → glitch mode**
1. Press `G`. Verify paint mode switches to glitch (⌢).

**TC-U07: ? → shortcut help**
1. Click `?` in toolbar. Verify the keyboard shortcuts modal opens.
2. Verify it lists all shortcuts. Close the modal.

---

### Section V: Axis Toggle

**TC-V01: Toggle time axis on**
1. Click `Axis` in toolbar. Verify the time axis row appears at the top of the canvas.

**TC-V02: Toggle time axis off**
1. Click `Axis` again. Verify the time axis row hides.

---

### Section W: Draft Recovery (Persistence)

**TC-W01: State persists on reload**
1. Add signals, paint waveforms, set a title. Reload the browser page.
2. Verify the exact diagram (signals, waveforms, title) is restored.

**TC-W02: Theme persists on reload**
1. Change theme to `Light grey` and accent to Teal. Reload.
2. Verify theme and accent color are preserved.

---

### Section X: Edge Cases & Error Handling

**TC-X01: Empty diagram — no signals**
1. Delete all signals. Verify the app doesn't crash. Canvas should render empty.

**TC-X02: Very large step count**
1. Set steps to 512 (max). Verify the app remains responsive, canvas scrolls.

**TC-X03: Rapid undo/redo**
1. Make 10+ changes. Rapidly click Undo 10 times, then Redo 10 times. Verify no crashes.

**TC-X04: Paint on spacer row**
1. Try to paint on a spacer row. Verify nothing happens (spacers have no waveform data).

**TC-X05: Delete last signal**
1. Delete all signals until one remains. Delete it. Verify no crash.

**TC-X06: Load sample while dirty**
1. Paint changes (dirty state). Load a sample. Verify a discard confirmation dialog appears.

**TC-X07: Context menu on canvas**
1. Right-click on the canvas. Verify no unhandled browser errors (app may show custom menu or suppress default).

**TC-X08: Double-click spacer name**
1. Double-click a spacer row's name. Verify inline editor works (spacers have no wave data but can be renamed).

---

### Section Y: Canvas Rendering Verification

**TC-Y01: Bit transitions render correctly**
1. Paint a sequence `0,1,0,1` on a BIT signal. Verify the canvas shows proper low-high-low-high transitions with diagonals.

**TC-Y02: Bus segment labels render**
1. On a BUS signal, create segments with labels. Verify the text renders inside the colored blocks.

**TC-Y03: Clock waveform render**
1. Paint a clock (p/n alternating). Verify smooth square-wave rendering with proper rise/fall edges.

**TC-Y04: Head/foot text renders on canvas**
1. Set head text and foot text. Verify they render above and below the waveform area.

**TC-Y05: Edge arrows render on canvas**
1. Place an arrow edge. Verify the arrow path and optional label render on the canvas overlay.

**TC-Y06: Glitch marker render**
1. Add a glitch on a transition. Verify a small spike/notch renders at the glitch point.

---

### Section Z: Cross-Feature Integration

**TC-Z01: Paint → JSON sync**
1. Paint waveforms on canvas. Verify JSON panel updates in real time.

**TC-Z02: JSON → canvas sync**
1. Edit wave strings in JSON. Blur. Verify canvas reflects changes.

**TC-Z03: Load sample → edit → export**
1. Load the `Clock and reset` sample. Change the title. Paint extra values. Export as PNG. Verify the full workflow completes without errors.

**TC-Z04: Add signals → group → reorder → export JSON**
1. Add 3 signals. Create a group. Move 2 signals into the group. Reorder them. Export as JSON. Verify the exported JSON has nested `signal` array with group.

**TC-Z05: Edges survive round-trip**
1. Place 2 arrows and 1 timespan. Toggle JSON panel. Verify `edge` array has 3 entries. Toggle render preview. Verify edges render in the WaveDrom SVG.

**TC-Z06: Undo through complex workflow**
1. Add signal → paint → add edge → change title → change steps. Undo 5 times. Verify each step reverts correctly in order.

**TC-Z07: Multi-signal selection + delete steps**
1. Select 3 signals (Ctrl+A or drag-select). Select a step range. Press Delete. Verify all 3 signals are erased for that range only.

**TC-Z08: Bus paint + segment editor consistency**
1. Paint a bus segment on canvas with label `X`. Open the segment editor. Verify the segment shows label `X`. Change it to `Y` in the editor. Verify canvas updates.

---

### Section HP: Hardware Protocol & Timing Diagram Use Cases

**TC-HP01: SPI (Serial Peripheral Interface) Read Transaction**
1. Create/setup 4 signals:
   - `SCLK` (BIT, Clock period=2, initial=0)
   - `CS_N` (BIT, wave `1.0.......1`)
   - `MOSI` (BUS, segments: steps 1-5 `0x03` (read command), steps 5-9 `idle`)
   - `MISO` (BUS, segments: steps 1-5 `Hi-Z` (or color 2), steps 5-9 `0x5A` (data byte))
2. Paint clock transitions, bus segments, and set states.
3. Add a timespan across steps 1 to 9 labeled `SPI Byte Transfer`.
4. Verify the WaveDrom preview shows a clean SPI read sequence with labels.

**TC-HP02: AXI-Stream Ready-Valid Handshake with Master & Slave Stalls**
1. Create/setup signals:
   - `ACLK` (BIT, Clock period=2)
   - `ARESETN` (BIT, wave `0.1........`)
   - `TVALID` (BIT, wave `0.01.10.11.`)
   - `TREADY` (BIT, wave `0.00.11.01.`)
   - `TDATA` (BUS, segments: steps 2-5 `DataA`, steps 5-7 `DataB`, steps 7-9 `DataC`)
2. Verify:
   - Step 2: RESET is active, handshake disabled.
   - Step 3: TVALID=1, TREADY=0 (slave stall, Master holds DataA).
   - Step 4: TVALID=1, TREADY=1 (successful handshake of DataA).
   - Step 5: TVALID=0, TREADY=1 (Master stall, no handshake).
   - Step 6: TVALID=1, TREADY=1 (successful handshake of DataB).
3. Verify that the WaveDrom diagram and JSON represent this standard protocol handshake correctly.

**TC-HP03: SRAM Write Cycle (Write Enable Pulse)**
1. Create/setup signals:
   - `CLK` (BIT, Clock period=2)
   - `ADDR` (BUS, segments: steps 1-4 `0x1000` (Write Addr))
   - `WE` (BIT, wave `0.0110....` (Write Enable Active High))
   - `WDATA` (BUS, segments: steps 1-4 `0xDEADBEEF` (Write Data))
   - `DQ` (BUS, segments: steps 0-4 `Hi-Z`)
2. Add dependency arrows:
   - From `ADDR` start (step 1) to `WE` assertion (step 2) to indicate Address Setup Time.
   - From `WE` deassertion (step 3) to `ADDR`/`WDATA` change (step 4) to indicate Address/Data Hold Time.
3. Verify the arrows align nicely and represent setup/hold times.

**TC-HP04: SRAM Read Cycle with Tri-State Turnaround**
1. Create/setup signals:
   - `CLK` (BIT, Clock period=2)
   - `ADDR` (BUS, segments: steps 1-5 `0x2000` (Read Addr))
   - `WE` (BIT, wave `0.00000...`)
   - `OE` (BIT, wave `0.01110...` (Output Enable))
   - `DQ` (BUS, segments: steps 0-2 `Hi-Z` (color 2), steps 2-4 `0xCAFEBABE` (Read Data), steps 4-6 `Hi-Z`)
2. Verify that the bus data line correctly transitions from a High-Z state (rendered empty/hatched or color-specific) to active data, and back to high-impedance state.

**TC-HP05: I2C (Inter-Integrated Circuit) Start & Stop Conditions**
1. Create/setup signals:
   - `SCL` (BIT, wave `1.1010101011`)
   - `SDA` (BIT, wave `1.0001010111`)
2. Verify Start Condition: `SDA` falls from 1 to 0 while `SCL` is 1 (step 1).
3. Verify Stop Condition: `SDA` rises from 0 to 1 while `SCL` is 1 (step 8).
4. Add timespan annotations labeling the first event as `START` and the last event as `STOP`.
5. Verify timing rules are visually clear.

**TC-HP06: UART (Universal Asynchronous Receiver-Transmitter) TX Frame**
1. Create/setup signals:
   - `TX` (BIT, wave `1.010101011.` - representing: Idle (1), Start (0), Data `0x55` (1-0-1-0-1-0-1-0), Stop (1), Idle (1))
2. Add timespans:
   - Steps 0-1: `Idle`
   - Steps 1-2: `Start`
   - Steps 2-10: `Data (0x55)`
   - Steps 10-11: `Stop`
3. Verify UART frame formatting fits spec.

**TC-HP07: AHB (Advanced High-performance Bus) Single Write with Wait States**
1. Create/setup signals:
   - `HCLK` (BIT, Clock period=2)
   - `HSEL` (BIT, wave `1.1........`)
   - `HTRANS` (BUS, segments: steps 1-2 `NONSEQ`, steps 2-5 `IDLE`)
   - `HWRITE` (BIT, wave `0.1111....`)
   - `HADDR` (BUS, segments: steps 1-2 `0x8000`, steps 2-5 `0x0000`)
   - `HWDATA` (BUS, segments: steps 2-4 `0xAAAA` (Wait State data phase), steps 4-6 `0xBBBB`)
   - `HREADY` (BIT, wave `0.101.....` - indicating 1 wait state at step 3)
2. Verify the timing of address to data phase.

---

### Section WD: WaveDrom Special Syntax Features

**TC-WD01: Column Gaps (`|`)**
1. Open the JSON panel. In any signal's wave string, insert a `|` character (e.g. `wave: "010|10"`).
2. Blur. Verify the canvas renders a vertical gap (broken line) between columns 2 and 3.

**TC-WD02: Consecutive Gaps (`||`)**
1. Edit JSON wave string to contain `wave: "1.||.0"`.
2. Blur. Verify multiple vertical gaps render and the diagram remains structurally sound.

**TC-WD03: Repeating States (Glitch Waveform `00`/`11`)**
1. In JSON wave, type `wave: "001100"`.
2. Verify it renders transitions on every step, even with the same logic levels, drawing glitch/transition hashes.

**TC-WD04: Weak Pull-Up (`u`) and Pull-Down (`d`) Rendering**
1. Set a signal's wave to `"u.d.u.d."` in JSON.
2. Verify `u` renders as a dashed/lighter line at high level, and `d` renders as a dashed/lighter line at low level.

**TC-WD05: Empty Bus Segment Data slots**
1. Create a BUS signal with wave `"=...=..."` and data `["", "active"]`.
2. Verify the first segment displays with NO text label (empty but colored), and the second displays "active".

**TC-WD06: Single character `0` as Bus Data Label**
1. Set a BUS signal's wave to `"=..."` and data to `["0"]`.
2. Verify the label "0" is displayed explicitly in the segment block (and not omitted or treated as falsy).

**TC-WD07: Arrow Path Styles (`~`, `-~`, orthogonal `-|`, `|-`)**
1. Edit JSON `edge` array to:
   - `["a~>b spline"]`
   - `["c-~>d horizontal-spline"]`
   - `["e-|f orthogonal-corner"]`
   - `["g|-h vertical-corner"]`
   - `["i-|-j multi-orthogonal"]`
2. Blur and verify all arrow variants render correctly on the canvas and in the preview.

**TC-WD08: Bi-directional Arrows / Timespans (`<->`)**
1. In JSON `edge`, insert `["a<->b 20ns"]` or `["a<~>b labels"]`.
2. Verify the rendering has double-ended arrows on both nodes.
