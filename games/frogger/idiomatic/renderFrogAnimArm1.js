// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm1  —  ROM 0x1058  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Render arm 1 of Frogger's eleven-arm frog-animation pipeline. Each frame the animation dispatcher
 *   (dispatchFrogAnimationArm, ROM 0x0faf) fans out to a chain of render arms, one per on-screen lane;
 *   each arm repaints its lane's tile columns into VRAM and, as a side effect, rewrites the lane's sprite
 *   object list. Arm 1 owns lane nibble 4 — the list at LANE_OBJLIST_8109 (0x8109) — which the frog-vs-lane
 *   move resolver reads back on the same frame. So this routine is one end of a shared data structure: it
 *   WRITES the object list (count byte + per-column X positions) that the collision test then SCANS.
 *
 * WHERE IT SITS
 *   Arm 1 is unique among the eleven arms in one way: it alone runs a guarded pre-blit
 *   (blitFrogAnimColumnOnTrigger, ROM 0x0f8c) before its own render, to service a one-shot repaint of the
 *   death/hop dive column. Everything after that pre-blit is the standard arm shape shared by every arm:
 *   read a three-byte parameter triple, park the triple's stride byte and the tile-source base into the
 *   render loop's scratch cells, then enter the shared tile-column loop (renderFrogAnimTileColumns, ROM
 *   0x0ff1) with this arm's row-count, column-count, VRAM destination, tile source, and plot cursors. The
 *   render loop tail-calls the index advance, which re-dispatches the NEXT arm — so control never returns
 *   here; the whole arm chain unwinds through one entry.
 *
 * LIVE-OUT
 *   Memory only. It stamps tile cells into VRAM, rewrites lane list 0x8109, and (via the pre-blit) may
 *   repaint the dive column. It returns whatever the shared loop's tail-call chain returns — nothing the
 *   caller reads — and leaves no register the caller depends on.
 */
import { SCROLL_OBJECT_BLOCK_BASE, SCROLL_COPY_DEST_PTR, LANE_OBJLIST_8109, SCROLL_COPY_COLUMN_STRIDE, SCROLL_COPY_SRC_PTR, SCROLL_GRID_SRC_PHASE16 } from "./names.js";
import { blitFrogAnimColumnOnTrigger } from "./blitFrogAnimColumnOnTrigger.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm1(m) {
  const { mem8, mem16 } = m;

  // ── Pre-blit: service the one-shot dive-column repaint (arm 1 only) ────────────────────
  // Before its own render, arm 1 fires the trigger-gated column blit. It repaints the eight-row descending
  // dive column at 0xa806 only when FROG_ANIM_BLIT_TRIGGER (0x8118) is armed — the death/hop animation sets
  // that trigger — and clears the trigger on the way out so the paint happens once per arming. On the vast
  // majority of frames the trigger is clear and this returns immediately, touching no memory. No other arm
  // has this step; it is why arm 1 has a distinct body from its siblings.
  blitFrogAnimColumnOnTrigger(m);

  // ── Read arm 1's three-byte parameter triple ──────────────────────────────────────────
  // The eleven arms' triples are packed contiguously in the 33-byte ACTIVE_LANE_PARAM_BLOCK (0x8270), arm k
  // at offset 3·k. SCROLL_OBJECT_BLOCK_BASE (0x8273) is exactly that block + 3 — arm 1's slot — aliased
  // under a scroll-object name because this same block also feeds the scroll-reveal stamp. The triple is
  // refreshed each life from the active player's difficulty table, so board difficulty tunes these counts.
  //   +0  spriteCode  — the triple's stride byte; doubles as the render loop's between-column dest advance.
  //   +1  rowCount    — tile-pairs to copy per column (rows per column).
  //   +2  columnCount — number of columns this arm stamps (the render loop's outer counter; 0 wraps to 256).
  const spriteCode = mem8[SCROLL_OBJECT_BLOCK_BASE];
  const rowCount = mem8[SCROLL_OBJECT_BLOCK_BASE + 1];
  const columnCount = mem8[SCROLL_OBJECT_BLOCK_BASE + 2];

  // ── Park the arm's stride + tile source into the render loop's scratch cells ───────────
  // The shared render loop reloads two values per column from fixed scratch cells rather than from its
  // arguments, so an arm must stash them here before entering:
  //   • SCROLL_COPY_COLUMN_STRIDE (0x81b1) ← the triple's stride byte, the amount the loop advances the
  //     VRAM destination between columns.
  //   • SCROLL_COPY_SRC_PTR (0x8001) ← this arm's tile-source base SCROLL_GRID_SRC_PHASE16 (0x1423, a ROM
  //     address), so every column restarts its row copy from the same source block.
  mem8[SCROLL_COPY_COLUMN_STRIDE] = spriteCode;
  mem16[SCROLL_COPY_SRC_PTR] = SCROLL_GRID_SRC_PHASE16;

  // ── Enter the shared tile-column render loop ───────────────────────────────────────────
  // Hand the loop this arm's parameters explicitly (matching the Z80 register live-ins it inherited):
  //   • rowCount / columnCount  — rows per column and number of columns, from the triple above.
  //   • mem16[SCROLL_COPY_DEST_PTR] (0x13ef) — arm 1's VRAM destination base, read as a ROM word (0xa808)
  //     from the per-arm pointer table at 0x13ed + 2·k.
  //   • SCROLL_GRID_SRC_PHASE16 (0x1423) — the initial tile source (same base just parked in scratch).
  //   • LANE_OBJLIST_8109 (0x8109) twice — the two plot cursors (IX and IY) both start at arm 1's lane
  //     object list. This IS the cross-link: the loop writes the per-column negated X into the list and
  //     bumps its leading count byte, producing the [count, x0, x1, …] layout the move resolver scans.
  // The loop tail-calls advanceFrogAnimIndexAndRedispatch, which fires the next arm — so this `return`
  // carries the whole arm chain's result, not a value this routine produced.
  return renderFrogAnimTileColumns(m, rowCount, columnCount, mem16[SCROLL_COPY_DEST_PTR], SCROLL_GRID_SRC_PHASE16, LANE_OBJLIST_8109, LANE_OBJLIST_8109);
}
