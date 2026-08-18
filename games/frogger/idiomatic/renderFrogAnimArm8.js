// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm8  —  ROM 0x1138  ·  grounding: [code]
 *
 * WHAT IT IS
 *   Arm 8 of Frogger's eleven-arm frog-animation pipeline. Each arm repaints one lane's scrolling sprite
 *   objects (cars, logs, turtles, …) into VRAM and, as a side effect, rewrites the lane object list that
 *   the horizontal-move collision resolver later scans. There is nothing frog-specific about "arm 8" — it
 *   is simply the eighth of eleven near-identical render bodies the animation dispatcher jumps to by the
 *   current anim-index (0x8000).
 *
 * WHERE IT SITS
 *   dispatchFrogAnimationArm (0x0faf) reads the anim-index cell (0x8000, a value 0..10) and jumps here
 *   when the index selects arm 8. This routine does no rendering itself: it only unpacks arm 8's three
 *   render parameters and its two ROM base pointers, parks the parameters where the shared loop expects
 *   them, and tail-calls renderFrogAnimTileColumns (0x0ff1) — the one copy loop every arm shares — which
 *   does the actual VRAM stamping, the sprite-X plotting, and then advances the anim-index to the next arm.
 *
 * THE DATA IT DRIVES
 *   All eleven arms differ only in three inputs, and this routine's whole job is to select arm 8's:
 *     - a 3-byte PARAMETER TRIPLE, packed contiguously in ACTIVE_LANE_PARAM_BLOCK (0x8270) at offset 3·8;
 *     - a VRAM DESTINATION base, read from a per-arm ROM pointer word (FROG_ANIM_ARM8_DEST_PTR, 0x13fd);
 *     - a ROM TILE-SOURCE base (FROG_ANIM_ARM8_SRC_BASE, 0x14ab).
 *   The plot cursors it hands the loop are arm 8's lane object list LANE_OBJLIST_8148 (0x8148) — the same
 *   list the move resolver scans — so rendering and collision are two ends of one data structure.
 *
 * LIVE-OUT
 *   Memory only. It writes two scratch cells (SCROLL_COPY_COLUMN_STRIDE, SCROLL_COPY_SRC_PTR) as inputs to
 *   the shared loop and returns whatever that loop returns (which is itself memory-only). No register or
 *   value the caller reads.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8148,
  FROG_ANIM_ARM8_DEST_PTR,
  FROG_ANIM_ARM8_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm8(m) {
  const { mem8, mem16 } = m;

  // ── Unpack arm 8's parameter triple from the active lane block ────────────────────────
  // ACTIVE_LANE_PARAM_BLOCK (0x8270) is the 33-byte block that loadActivePlayerLaneParams copies in from
  // the active player's difficulty table each life, so these three bytes are what board difficulty tunes.
  // The eleven triples are packed back-to-back; arm k lives at offset 3·k, so arm 8 reads 0x8288..0x828a.
  // The three bytes are, in ROM order, the column-stride byte, the row-count, and the column-count:
  //   +24 (0x8288): the destination's per-column advance — despite the local name, this is the COLUMN
  //                 STRIDE the loop adds between columns, stashed below into SCROLL_COPY_COLUMN_STRIDE.
  const columnStride = mem8[ACTIVE_LANE_PARAM_BLOCK + 24];
  //   +25 (0x8289): rows per column — how many two-byte tile-pairs the loop copies straight down each col.
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 25];
  //   +26 (0x828a): the number of columns to paint — the loop's outer counter (a 0 there means 256). The
  //                 local name says "index" but the shared loop consumes it as the column COUNT.
  const columnCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 26];

  // ── Read arm 8's VRAM destination base from its ROM pointer word ──────────────────────
  // FROG_ANIM_ARM8_DEST_PTR (0x13fd) is a ROM word (part of the per-arm pointer table at 0x13ed + 2·k)
  // holding the top-left VRAM cell where this lane's column grid is stamped. mem16 reads it little-endian.
  const destPtr = mem16[FROG_ANIM_ARM8_DEST_PTR];

  // ── Park the two loop inputs the shared render loop reads back from scratch RAM ────────
  // The shared loop reloads the column stride and the tile-source base from these two scratch cells on
  // every column (so each column restarts from the same source and steps by the same stride). The arm's
  // job is to seed them before entering the loop:
  //   SCROLL_COPY_COLUMN_STRIDE (0x81b1): the per-column destination advance (the +24 byte above).
  mem8[SCROLL_COPY_COLUMN_STRIDE] = columnStride;
  //   SCROLL_COPY_SRC_PTR (0x8001): arm 8's ROM tile-source base (0x14ab), so column 2..N re-read from it.
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM8_SRC_BASE;

  // ── Enter the shared tile-column render loop ──────────────────────────────────────────
  // renderFrogAnimTileColumns (0x0ff1) does the real work for every arm: for each of `columnCount` columns
  // it computes the on-screen column, plots the negated column as a sprite X into the plot cursors, copies
  // `rowCount` tile-pairs down the destination, and advances the destination by the parked column stride;
  // on the last column it hands to advanceFrogAnimIndexAndRedispatch to step the anim-index. Both plot
  // cursors are arm 8's lane object list LANE_OBJLIST_8148 (0x8148): the IX cursor writes each object's X
  // there and the IY cursor bumps its leading count byte — repopulating exactly the list the move resolver
  // will scan. Passing FROG_ANIM_ARM8_SRC_BASE here too gives the loop its first-column source (columns
  // 2..N reload it from the SCROLL_COPY_SRC_PTR cell seeded above). Tail-call: its return value is ours.
  return renderFrogAnimTileColumns(m, rowCount, columnCount, destPtr, FROG_ANIM_ARM8_SRC_BASE, LANE_OBJLIST_8148, LANE_OBJLIST_8148);
}
