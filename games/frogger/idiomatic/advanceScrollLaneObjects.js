// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceScrollLaneObjects  —  ROM 0x2005  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame clock for Frogger's incrementally-redrawn river background. The playfield is not
 *   painted whole each frame; instead two independent "scroll objects" and one master phase counter are
 *   stepped one tick per in-play frame, and threshold crossings fire the actual VRAM work: a reveal-
 *   column stamp, a six-row band blit, and — on three exact phase marks — a full two-object grid copy.
 *   Run this routine 256 times and the background has scrolled and re-tiled one full cycle.
 *
 * WHERE IT SITS
 *   Called once per in-play frame from both the in-play frame-update sequence (driveInPlayFrameUpdate)
 *   and the vblank service path. It owns three RAM counters and two 3-byte object descriptors and does
 *   nothing but step them and dispatch to four tile-copy leaves (stampScrollRevealColumn, blitScrollBand,
 *   blitScrollTileGrid, blitScrollTileGridAlt). Attract mode never reaches it (its caller guards are dead
 *   during the demo), which is why the equivalence test has to craft entries by hand.
 *
 * LIVE-OUT
 *   Memory only. It writes the two row-count shadows, advances the three counters, and — through its
 *   leaves — stamps VRAM. It returns nothing the caller reads (both callers reload their registers after
 *   the call), so the trailing `return` on the dispatch lines only preserves the ROM's tail-call shape.
 */
import {
  SCROLL_OBJECT_BLOCK_BASE, SCROLL_OBJ_A_ROW_COUNT, SCROLL_BAND_DESCRIPTOR_BASE, SCROLL_OBJ_B_ROW_COUNT, SCROLL_STAMP_ROWCOUNT, SCROLL_BAND_ROWSPAN,
  SCROLL_STAMP_PHASE, SCROLL_BAND_PHASE, SCROLL_PHASE_COUNTER, SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_GRID_SRC_PHASE16, SCROLL_BAND_SRC_PHASE16, SCROLL_GRID_SRC_PHASE32, SCROLL_BAND_SRC_PHASE32, SCROLL_GRID_SRC_PHASE48, SCROLL_BAND_SRC_PHASE48,
} from "./names.js";
import { stampScrollRevealColumn } from "./stampScrollRevealColumn.js";
import { blitScrollBand } from "./blitScrollBand.js";
import { blitScrollTileGrid, blitScrollTileGridAlt } from "./blitScrollTileGrid.js";

// Each scroll object is a 3-byte descriptor: +0 = column-stride byte, +1 = row count, +2 = the byte that
// gets shadowed each frame. SCROLL_BYTE selects that +2 field. The reveal stamp and band blit interpret
// +2 as a row count, and the driver mirrors it into a shadow cell so the copy engine reads a value frozen
// for this frame rather than one changing mid-pass.
const SCROLL_BYTE = 2;

// Object A stamps a reveal column once its counter SCROLL_STAMP_PHASE (0x8110) reaches or passes 80. 80 is
// also the first counter value stampScrollRevealColumn dispatches on to select a ROM stamp table.
const COUNTER_A_STAMP = 80;

// Object B blits its band only while its counter SCROLL_BAND_PHASE (0x8111) stays BELOW 160. This is an
// upper bound, not a floor: once the counter climbs past it (it steps by 2, so it reaches 158/160/162…),
// blitScrollBand is skipped for the rest of the up-swing.
const COUNTER_B_BLIT_LIMIT = 160;

// The three exact master-phase values that trigger a full two-object lane re-stamp. Each mark feeds a
// fixed pair of ROM source blocks into the copy engine; 48 is the wrap point that also resets the counter.
const PHASE_MARK_16 = 16;
const PHASE_MARK_32 = 32;
const PHASE_MARK_48 = 48;

export function advanceScrollLaneObjects(m) {
  const { mem8 } = m;

  // ── Object A: snapshot then step ─────────────────────────────────────────────────────
  // Freeze object A's +2 descriptor byte into its row-count shadow SCROLL_STAMP_ROWCOUNT (0x811a) BEFORE
  // touching the counter — the grid copy at phase 16/32/48 reads the shadow, not the live descriptor.
  // Then advance object A's phase counter SCROLL_STAMP_PHASE (0x8110) by +1 (8-bit wrap). When it reaches
  // or passes 80, stampScrollRevealColumn (0x20fb) paints a narrow reveal column, dispatching on the new
  // counter value (80/208, 128/176, 160) to pick which ROM stamp table it uses.
  mem8[SCROLL_STAMP_ROWCOUNT] = mem8[SCROLL_OBJECT_BLOCK_BASE + SCROLL_BYTE];
  const a = (mem8[SCROLL_STAMP_PHASE] + 1) & 0xff;
  mem8[SCROLL_STAMP_PHASE] = a;
  if (a >= COUNTER_A_STAMP) stampScrollRevealColumn(m);

  // ── Object B: snapshot then step (double rate) ───────────────────────────────────────
  // Same shape for object B: freeze its +2 byte into the row-span shadow SCROLL_BAND_ROWSPAN (0x8119),
  // then advance object B's phase counter SCROLL_BAND_PHASE (0x8111) by +2 — TWICE object A's rate, so the
  // band scrolls at double speed. While the counter is still below 160, blitScrollBand (0x219c) blits a
  // six-row tile band, choosing one of three ROM source rows by the counter value (0/112, 48/96, 80).
  mem8[SCROLL_BAND_ROWSPAN] = mem8[SCROLL_BAND_DESCRIPTOR_BASE + SCROLL_BYTE];
  const b = (mem8[SCROLL_BAND_PHASE] + 2) & 0xff;
  mem8[SCROLL_BAND_PHASE] = b;
  if (b < COUNTER_B_BLIT_LIMIT) blitScrollBand(m);

  // ── Master phase counter: the lane re-stamp clock ────────────────────────────────────
  // The master clock SCROLL_PHASE_COUNTER (0x826e) steps by +1 each frame. On the three exact marks
  // 16/32/48 it runs a full lane re-stamp that feeds BOTH objects into the shared copy engine; each mark
  // selects a fixed pair of ROM source blocks (a grid source for object A, a band source for object B).
  // Phase 48 is the wrap point — it passes wrapPhase=true so stampLanes also zeroes the counter before
  // copying, restarting the 0→48 cycle.
  const phase = (mem8[SCROLL_PHASE_COUNTER] + 1) & 0xff;
  mem8[SCROLL_PHASE_COUNTER] = phase;
  if (phase === PHASE_MARK_16) return stampLanes(m, SCROLL_GRID_SRC_PHASE16, SCROLL_BAND_SRC_PHASE16, false);
  if (phase === PHASE_MARK_32) return stampLanes(m, SCROLL_GRID_SRC_PHASE32, SCROLL_BAND_SRC_PHASE32, false);
  if (phase === PHASE_MARK_48) return stampLanes(m, SCROLL_GRID_SRC_PHASE48, SCROLL_BAND_SRC_PHASE48, true);
}

/**
 * The two-part lane re-stamp fired at master phase 16/32/48. Object A is copied as a grid through the
 * default-destination engine (VRAM 0xa808), then object B through the alternate-destination engine (a
 * different VRAM region), so the two objects paint side by side from one shared copy loop.
 */
function stampLanes(m, gridSource, bandSource, wrapPhase) {
  const { mem8 } = m;

  // ── Object A → grid copy ─────────────────────────────────────────────────────────────
  // Row count comes from object A's +1 descriptor field SCROLL_OBJ_A_ROW_COUNT (0x8274); the column count
  // is the shadow SCROLL_STAMP_ROWCOUNT (0x811a) frozen at the top of the frame; the copy engine's per-
  // column stride SCROLL_COPY_COLUMN_STRIDE (0x81b1) is loaded from object A's +0 byte. On the wrap phase
  // (48) the master counter is cleared to 0 here, BEFORE the copy, matching the ROM's ordering. Then
  // blitScrollTileGrid (0x20cc) stamps the grid into VRAM through the default destination pointer.
  const gridRows = mem8[SCROLL_OBJ_A_ROW_COUNT];
  const gridCols = mem8[SCROLL_STAMP_ROWCOUNT];
  mem8[SCROLL_COPY_COLUMN_STRIDE] = mem8[SCROLL_OBJECT_BLOCK_BASE];
  if (wrapPhase) mem8[SCROLL_PHASE_COUNTER] = 0;
  blitScrollTileGrid(m, gridSource, gridRows, gridCols);

  // ── Object B → alt-base grid copy ────────────────────────────────────────────────────
  // Same shape for object B: rows from its +1 field SCROLL_OBJ_B_ROW_COUNT (0x827d), columns from the
  // band shadow SCROLL_BAND_ROWSPAN (0x8119), stride from object B's +0 byte. blitScrollTileGridAlt is the
  // identical copy loop reading its destination base from the ALTERNATE ROM pointer, so object B lands in
  // a separate VRAM region and doesn't overwrite object A. Tail-call: its return is memory-only.
  const bandRows = mem8[SCROLL_OBJ_B_ROW_COUNT];
  const bandCols = mem8[SCROLL_BAND_ROWSPAN];
  mem8[SCROLL_COPY_COLUMN_STRIDE] = mem8[SCROLL_BAND_DESCRIPTOR_BASE];
  return blitScrollTileGridAlt(m, bandSource, bandRows, bandCols);
}
