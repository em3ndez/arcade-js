// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm9  —  ROM 0x1158  ·  grounding: [code]
 *
 * WHAT IT IS
 *   Render arm 9 of Frogger's eleven-arm frog-animation pipeline. Every frame the play scene is redrawn,
 *   `dispatchFrogAnimationArm` (0x0faf) reads the animation-index cell (0x8000) and jumps to one of eleven
 *   near-identical "arms" (0..10), each of which repaints one lane's sprite objects. This is arm 9. Like its
 *   siblings it does almost no work itself: it reads a small per-arm parameter block, parks two values in the
 *   scratch cells the shared render loop rereads, then hands off to that loop. It has no pre-blit (only arm 1
 *   does), and its parameters sit near the tail of the shared block.
 *
 * WHERE IT SITS
 *   Called by `dispatchFrogAnimationArm` when the animation index selects arm 9. Because the shared loop
 *   tail-recurses through `advanceFrogAnimIndexAndRedispatch`, a normal per-frame sweep that starts at index 0
 *   reaches arm 9 near the end of the run, just before arm 10. Arm 9 owns lane nibble 12, whose object list is
 *   LANE_OBJLIST_8151 (0x8151 = 0x8100 + 9·9): the very list the move resolver (dispatchFrogMoveAgainstLanes)
 *   scans back to hit-test the frog. So this render and the collision test are two ends of one data structure
 *   — arm 9 writes the list, the resolver reads it.
 *
 * LIVE-OUT
 *   Memory only. It writes two scratch cells (column stride, source pointer), then the shared loop it
 *   tail-calls stamps VRAM and the lane object list. It returns nothing the caller reads.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8151,
  FROG_ANIM_ARM9_DEST_PTR,
  FROG_ANIM_ARM9_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm9(m) {
  const { mem8, mem16 } = m;

  // ── Read arm 9's parameter triple ────────────────────────────────────────────────────
  // ACTIVE_LANE_PARAM_BLOCK (0x8270) is a 33-byte block reloaded each life from the active player's
  // difficulty table by loadActivePlayerLaneParams, so board difficulty tunes every arm. The eleven arms'
  // triples are packed contiguously — arm k reads its triple at offset 3·k — and arm 9's lives at +27:
  //   +27 → the column stride: how far the destination advances between columns (stashed below).
  //   +28 → the row count: tile-pairs copied straight down each column.
  //   +29 → the column count: how many columns this arm stamps.
  const columnStride = mem8[ACTIVE_LANE_PARAM_BLOCK + 27];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 28];
  const columnCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 29];

  // ── Take arm 9's VRAM destination base ───────────────────────────────────────────────
  // Each arm's paint origin comes from a ROM pointer table at 0x13ed + 2·k. Arm 9's slot is
  // FROG_ANIM_ARM9_DEST_PTR (0x13ff = 0x13ed + 2·9); read the 16-bit VRAM address the loop starts stamping at.
  const destPtr = mem16[FROG_ANIM_ARM9_DEST_PTR];

  // ── Park the two values the shared loop rereads per column ────────────────────────────
  // The render loop does not carry the stride or the source in registers across its column iterations; it
  // reloads them from scratch cells each pass. So stash the column stride into SCROLL_COPY_COLUMN_STRIDE
  // (0x81b1) — the loop adds it to the destination between columns — and the arm's tile-source base
  // FROG_ANIM_ARM9_SRC_BASE (0x14af) into SCROLL_COPY_SRC_PTR (0x8001), so every column restarts its row
  // copy from the same source base.
  mem8[SCROLL_COPY_COLUMN_STRIDE] = columnStride;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM9_SRC_BASE;

  // ── Enter the shared tile-column render loop ─────────────────────────────────────────
  // Hand over this arm's row count (rows per column), column count, VRAM destination, and tile source. The
  // last two args are the plot cursors — both seeded to LANE_OBJLIST_8151 (0x8151), arm 9's lane object list.
  // Inside the loop one cursor (IX) writes each column's negated index as the sprite X into the list, the
  // other (IY) bumps the list's leading count byte, building the [count, x0, x1, …] record the move resolver
  // reads back. This is a plain tail-call: the loop stamps every column then hands to
  // advanceFrogAnimIndexAndRedispatch, which steps to the next arm; nothing here runs afterward.
  return renderFrogAnimTileColumns(m, rowCount, columnCount, destPtr, FROG_ANIM_ARM9_SRC_BASE, LANE_OBJLIST_8151, LANE_OBJLIST_8151);
}
