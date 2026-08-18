// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm10  —  ROM 0x1178  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The eleventh (index 10) and last render arm of the frog-animation pipeline. Every frame the animation
 *   dispatcher (dispatchFrogAnimationArm, ROM 0x0faf) walks the animation-index cell (0x8000) from its
 *   current value up through 10, jumping to one render arm per index; this is the arm it reaches at index
 *   10. Each arm repaints one lane's row of sprite objects into VRAM and re-plots that lane's object list.
 *   Arm 10 is the direct sibling of arm 9 (renderFrogAnimArm9): identical shape, just the next parameter
 *   triple, the next ROM pointers, and the next lane object list.
 *
 * WHERE IT SITS
 *   One of eleven interchangeable arms feeding a single shared engine. This arm does the small,
 *   arm-specific setup — pick this arm's parameters and stash the two scratch cells the engine reloads —
 *   then hands the whole job to the shared tile-column render loop (renderFrogAnimTileColumns, ROM 0x0ff1)
 *   as a tail-call. All eleven arms differ ONLY in the constants they feed that loop.
 *
 *   The cross-link that makes this matter: arm 10's plot cursor is LANE_OBJLIST_815A (0x815a) — the very
 *   same lane object list that the horizontal move resolver later scans to decide whether the frog's move
 *   is blocked / safe / fatal. So rendering this arm repopulates the exact list the collision test reads
 *   back. Render and hit-test are two ends of one data structure (see mechanisms.md "The frog-animation
 *   dispatcher and its eleven arms").
 *
 * LIVE-OUT
 *   Memory only. It writes two scratch cells (0x81b1, 0x8001) here and, via the shared loop, stamps tile
 *   pairs into VRAM and plots sprite Xs into the lane object list. It returns whatever the shared loop's
 *   tail (advanceFrogAnimIndexAndRedispatch) returns and leaves no register the caller reads.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_815A,
  FROG_ANIM_ARM10_DEST_PTR,
  FROG_ANIM_ARM10_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm10(m) {
  const { mem8, mem16 } = m;

  // ── This arm's parameter triple ──────────────────────────────────────────────────────
  // The 33-byte ACTIVE_LANE_PARAM_BLOCK (0x8270) packs one three-byte triple per arm at offset 3·arm, so
  // arm 10 reads at +30/+31/+32 (0x828e/0x828f/0x8290) — the last triple, which fills the block exactly
  // (11 arms × 3 bytes = 33). The block is refreshed each life from the active player's difficulty table
  // by loadActivePlayerLaneParams, so board difficulty tunes these counts. The three bytes are:
  //   +30 stride byte  — how far the VRAM destination steps between columns (stashed below as the column
  //                      stride); called "row-advance" in the block layout.
  //   +31 rowCount     — tile-rows the loop copies down each column (rows per column).
  //   +32 columnCount  — number of columns the loop renders (0 wraps to 256 in the loop's counter).
  const columnStride = mem8[ACTIVE_LANE_PARAM_BLOCK + 30];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 31];
  const columnCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 32];

  // The VRAM base this arm paints to is a fixed 16-bit ROM pointer, read from FROG_ANIM_ARM10_DEST_PTR
  // (0x1401) — arm 10's slot in the destination pointer table at 0x13ed + 2·arm.
  const destPtr = mem16[FROG_ANIM_ARM10_DEST_PTR];

  // ── Seed the two scratch cells the shared loop reloads ────────────────────────────────
  // The shared loop reloads the column stride from SCROLL_COPY_COLUMN_STRIDE (0x81b1) each column and the
  // tile source from SCROLL_COPY_SRC_PTR (0x8001) after each column, so this arm's stride and tile-source
  // base must be parked there before entry. The tile source is arm 10's per-arm ROM base
  // FROG_ANIM_ARM10_SRC_BASE (0x14b3).
  mem8[SCROLL_COPY_COLUMN_STRIDE] = columnStride;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM10_SRC_BASE;

  // ── Hand off to the shared render loop ────────────────────────────────────────────────
  // Tail-call the engine with this arm's parameters. The last two arguments are the pair of plot cursors
  // (IX / IY in the original) — both set to LANE_OBJLIST_815A (0x815a), arm 10's lane object list. The
  // loop stamps the tile pairs into VRAM and plots the negated on-screen column index as each sprite's X
  // into that list, then on the final column advances the animation index (arm 10 → 11, which wraps to 0).
  return renderFrogAnimTileColumns(m, rowCount, columnCount, destPtr, FROG_ANIM_ARM10_SRC_BASE, LANE_OBJLIST_815A, LANE_OBJLIST_815A);
}
