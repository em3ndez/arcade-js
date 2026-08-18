// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm2  —  ROM 0x107b  ·  grounding: [code]
 *
 * WHAT IT IS
 *   Frog-animation render arm 2 — one of the eleven interchangeable "arms" that repaint the moving
 *   lane objects each frame. Every arm redraws one lane's row of sprite tiles into VRAM and, as a side
 *   effect, rewrites the object list the collision code scans for that lane. Arm 2 owns lane 5.
 *
 * WHERE IT SITS
 *   dispatchFrogAnimationArm (0x0faf) reads the animation-index cell (0x8000, a value 0..10) and jumps
 *   to the arm with that number; arm 2 is this routine. It is a sibling of arm 0 — a plain arm with no
 *   pre-blit (only arm 1 runs a guarded pre-blit before its render). All arm 2 does is gather its own
 *   parameters, then hand off to the render loop that every arm shares (renderFrogAnimTileColumns,
 *   0x0ff1); that loop tail-recurses through advanceFrogAnimIndexAndRedispatch to the next arm, so one
 *   dispatch entry draws the whole run of arms in a single sweep.
 *
 * LIVE-OUT
 *   Memory only. It stamps tile cells into VRAM and repopulates lane 5's object list; it returns nothing
 *   the caller reads (the returned value is just the shared loop's own memory-only tail).
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8112,
  FROG_ANIM_ARM2_DEST_PTR,
  FROG_ANIM_ARM2_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

// Arm 2's parameter triple lives at offset 6 inside the lane block: arm k reads its triple at 3·k, so
// arm 0 is at +0, arm 1 at +3, arm 2 at +6/+7/+8. Named here so the three reads below read as one unit.
const ARM2_TRIPLE = 6;

export function renderFrogAnimArm2(m) {
  const { mem8, mem16 } = m;

  // ── Step 1: read this arm's parameter triple ─────────────────────────────────────────
  // The triple lives in ACTIVE_LANE_PARAM_BLOCK (0x8270), the 33-byte block loadActivePlayerLaneParams
  // copies out of the active player's difficulty table once per life — so board difficulty tunes these
  // three counts. Arm 2's slice is bytes 0x8276..0x8278:
  //   +6 row-advance  — the destination stride; how far the render loop steps the VRAM pointer between
  //                     columns. (Canonically "row-advance"; it is stashed as the COLUMN stride below.)
  //   +7 row-count    — tile-rows to copy down each column (the B register the loop consumes).
  //   +8 column-count — number of columns to render (the C register; 0 would wrap to 256).
  const columnStride = mem8[ACTIVE_LANE_PARAM_BLOCK + ARM2_TRIPLE];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + ARM2_TRIPLE + 1];
  const columnCount = mem8[ACTIVE_LANE_PARAM_BLOCK + ARM2_TRIPLE + 2];

  // ── Step 2: fetch this arm's VRAM destination base ───────────────────────────────────
  // FROG_ANIM_ARM2_DEST_PTR (0x13f1) is arm 2's slot in the ROM pointer table at 0x13ed + 2·k
  // (arm 0 → 0x13ed, arm 2 → 0x13f1). mem16 reads it as a little-endian word: the VRAM cell where the
  // render loop begins stamping this arm's tile columns.
  const destPtr = mem16[FROG_ANIM_ARM2_DEST_PTR];

  // ── Step 3: park the two per-arm values the shared loop reloads from scratch ──────────
  // The render loop does not carry the stride or the source base as locals — it re-reads them from these
  // scratch cells (the stride every column, the source at the top of each column) so that every column
  // restarts from the same tile-source base. Arm 2 must seed both before entering the loop:
  //   • SCROLL_COPY_COLUMN_STRIDE (0x81b1) ← row-advance: the inter-column destination step.
  //   • SCROLL_COPY_SRC_PTR (0x8001)       ← FROG_ANIM_ARM2_SRC_BASE (0x143b): arm 2's ROM tile source.
  mem8[SCROLL_COPY_COLUMN_STRIDE] = columnStride;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM2_SRC_BASE;

  // ── Step 4: hand off to the shared render loop ───────────────────────────────────────
  // renderFrogAnimTileColumns (0x0ff1) does the actual VRAM stamping and object-list plotting. It takes
  // the row-count (rows per column), column-count (number of columns), VRAM destination, tile source,
  // and BOTH plot cursors. Both cursors point at LANE_OBJLIST_8112 (0x8112) — arm 2's cursor base is
  // exactly lane 5's object list (band width 92), the list the move resolver later scans. As the loop
  // draws each column it writes the negated screen column into that list and bumps its leading count
  // byte, rebuilding the [count, x0, x1, …] record one-for-one, so render and collision read the same
  // structure. The loop tail-calls advanceFrogAnimIndexAndRedispatch; the returned value is that
  // memory-only tail, which our caller ignores.
  return renderFrogAnimTileColumns(m, rowCount, columnCount, destPtr, FROG_ANIM_ARM2_SRC_BASE, LANE_OBJLIST_8112, LANE_OBJLIST_8112);
}
