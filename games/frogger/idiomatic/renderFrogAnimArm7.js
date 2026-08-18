// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm7  —  ROM 0x1118  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   Render arm 7 of the frog-animation pipeline — one of the eleven arms the per-frame animation
 *   dispatcher jumps to by anim-index. Each arm repaints one lane's worth of scrolling sprite objects
 *   into VRAM and, as a side effect, rewrites that lane's object list. Arm 7 owns lane nibble 10.
 *
 * WHERE IT SITS
 *   dispatchFrogAnimationArm (0x0faf) reads the animation-index cell (0x8000) and vectors to this arm.
 *   Arm 7 is a plain sibling of arm 0 — no guarded pre-blit (only arm 1 has one). Its whole body is
 *   setup: pull this arm's parameter triple out of the lane-parameter block, park the stride + tile
 *   source in the two scratch cells the shared loop reloads, then jump into that shared loop. The loop
 *   itself does the VRAM stamping and, when it finishes this arm's columns, advances the anim-index and
 *   re-dispatches the next arm — so control does NOT come back here.
 *
 *   The plot cursor this arm hands the loop is the crucial cross-link: it points at the very lane object
 *   list (LANE_OBJLIST_813F, 0x813f) that the horizontal move resolver later scans for a blocker. So the
 *   render pass and the collision test are two ends of one data structure — arm 7 repopulates lane
 *   nibble 10 every time the scene renders, and the resolver reads back the counts/X-positions it wrote.
 *
 * LIVE-OUT
 *   Memory only. It writes the two scroll-copy scratch cells here, and (through the shared loop) VRAM
 *   tiles plus the lane object list. It leaves no register the caller reads.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_813F,
  FROG_ANIM_ARM7_DEST_PTR,
  FROG_ANIM_ARM7_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm7(m) {
  const { mem8, mem16 } = m;

  // ── This arm's parameter triple ──────────────────────────────────────────────────────
  // ACTIVE_LANE_PARAM_BLOCK (0x8270) is a 33-byte table holding eleven contiguous 3-byte triples, one
  // per render arm; arm k reads its triple at offset 3·k. Arm 7's triple therefore sits at +21/+22/+23
  // (0x8285/0x8286/0x8287). The block is refreshed each life from the active player's difficulty table
  // (loadActivePlayerLaneParams), so board difficulty tunes every arm's row/column counts.
  //   +21  columnStride  — the inter-column stride: how far the destination jumps to reach the next column
  //                      (misnamed "row-advance" by the arm family; it is the column stride below).
  //   +22  rowCount    — rows per column (how many two-byte tile-pairs to copy down each column).
  //   +23  columnCount — number of columns to stamp across.
  const columnStride = mem8[ACTIVE_LANE_PARAM_BLOCK + 21];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 22];
  const columnCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 23];

  // ── VRAM destination base ─────────────────────────────────────────────────────────────
  // Arm 7's destination is a fixed ROM pointer, read as a little-endian word from the per-arm slot in
  // the destination table: FROG_ANIM_ARM7_DEST_PTR (0x13fb). This is where the first column lands.
  const destPtr = mem16[FROG_ANIM_ARM7_DEST_PTR];

  // ── Park the two values the shared loop reloads from scratch ───────────────────────────
  // The render loop does not carry the stride or the source pointer as live registers across columns —
  // it reloads them from fixed scratch cells at the top of every column. So the arm has to stage them:
  //   • SCROLL_COPY_COLUMN_STRIDE (0x81b1): the between-column destination advance (the +21 byte). The
  //     loop adds this to the destination after finishing each column, so the columns march across VRAM.
  //   • SCROLL_COPY_SRC_PTR (0x8001): arm 7's tile-source base FROG_ANIM_ARM7_SRC_BASE (0x14a7), a ROM
  //     table of tile-pairs. The loop restarts the source from this cell at the top of each column.
  mem8[SCROLL_COPY_COLUMN_STRIDE] = columnStride;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM7_SRC_BASE;

  // ── Enter the shared tile-column render loop ──────────────────────────────────────────
  // In the ROM this is a fall-through / tail-jump into renderFrogAnimTileColumns (0x0ff1), so this arm
  // "returns" whatever that loop returns. Arguments, in the order the loop's positional params expect:
  //   rowCount    → rows per column (Z80 B)
  //   columnCount → number of columns (Z80 C)
  //   destPtr     → VRAM destination base (HL)
  //   source      → FROG_ANIM_ARM7_SRC_BASE (0x14a7), the same source parked above (DE)
  //   ixCursor,   → BOTH plot cursors point at LANE_OBJLIST_813F (0x813f): as the loop plots each column
  //   iyCursor      it stamps the negated screen-column as a sprite X into this list and bumps the row
  //                 cursor. 0x813f is lane nibble 10 — exactly the object list the move resolver
  //                 (loc_12e4) scans for a blocker, which is why arm 7 must rewrite it every frame.
  // When the loop exhausts arm 7's columns it hands to advanceFrogAnimIndexAndRedispatch (0x1029), which
  // bumps the anim-index and dispatches the next arm — control never returns to this function.
  return renderFrogAnimTileColumns(m, rowCount, columnCount, destPtr, FROG_ANIM_ARM7_SRC_BASE, LANE_OBJLIST_813F, LANE_OBJLIST_813F);
}
