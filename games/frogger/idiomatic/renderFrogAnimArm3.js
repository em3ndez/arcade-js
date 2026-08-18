// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm3  —  ROM 0x109b  ·  grounding: [code]
 *
 * WHAT IT IS
 *   Arm 3 of the eleven-arm frog-animation render pipeline. Each frame the animation dispatcher walks a
 *   run of these arms, and each arm repaints one lane's worth of scrolling sprite objects into VRAM
 *   through a single shared tile-column loop. This is the setup half for arm 3: it gathers arm 3's render
 *   parameters, publishes the two scratch cells the loop reads, then hands off to the loop. It is a
 *   parameter-only sibling of arm 0 — same shape, different triple/destination/source/cursor, and (unlike
 *   arm 1) no guarded pre-blit before the render.
 *
 * WHERE IT SITS
 *   Reached from dispatchFrogAnimationArm (0x0faf), which reads the animation-index cell (0x8000) and
 *   jumps to the arm matching the index. Because the shared loop tail-calls
 *   advanceFrogAnimIndexAndRedispatch (0x1029) — which bumps the index and re-dispatches the next arm
 *   until the index wraps at 0x0b — a single dispatch starting from index 0 draws all eleven arms in one
 *   sweep, so arm 3 normally runs once per rendered frame.
 *
 *   The crucial cross-link is the plot cursor. Arm 3's cursor base is LANE_OBJLIST_811B (0x811b), which is
 *   exactly the lane object list that the horizontal-move resolver later scans for that lane. So this arm
 *   does double duty: it stamps the lane's tiles into VRAM AND rewrites the lane's object list (count byte
 *   plus per-object X positions) that the collision test reads back — render and collision are two ends of
 *   one data structure.
 *
 * LIVE-OUT
 *   Memory only. It writes the two scroll-copy scratch cells (SCROLL_COPY_COLUMN_STRIDE 0x81b1 and
 *   SCROLL_COPY_SRC_PTR 0x8001), and everything else — VRAM tiles and the lane object list — is written by
 *   the shared loop it tail-calls. It returns whatever that tail call returns (the index-advance result);
 *   no register the caller reads is left behind.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_811B,
  FROG_ANIM_ARM3_DEST_PTR,
  FROG_ANIM_ARM3_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm3(m) {
  const { mem8, mem16 } = m;

  // ── Read arm 3's parameter triple ────────────────────────────────────────────────────
  // The eleven arms' 3-byte parameter triples are packed contiguously in the 33-byte
  // ACTIVE_LANE_PARAM_BLOCK (0x8270); arm k reads its triple at offset 3·k, so arm 3 lives at +9/+10/+11
  // (0x8279/0x827a/0x827b). The block is reloaded each life from the active player's difficulty table by
  // loadActivePlayerLaneParams (0x223d), so these three bytes are how board difficulty tunes arm 3's shape.
  //   +9  columnStride: fed to SCROLL_COPY_COLUMN_STRIDE — the destination advance BETWEEN columns.
  //   +10 rowCount:     rows per column (passed to the loop as register B).
  //   +11 columnCount:  number of columns to render (register C; a count, not an index — 0 wraps to 256).
  const columnStride = mem8[ACTIVE_LANE_PARAM_BLOCK + 9];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 10];
  const columnCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 11];

  // ── Read arm 3's VRAM destination ────────────────────────────────────────────────────
  // The destination base is a fixed ROM word in the per-arm pointer table at 0x13ed + 2·k; arm 3's slot is
  // FROG_ANIM_ARM3_DEST_PTR (0x13f3). Unlike the triple this never changes with difficulty — it names the
  // screen region arm 3 always paints.
  const destPtr = mem16[FROG_ANIM_ARM3_DEST_PTR];

  // ── Publish the two scratch cells the shared loop reloads per column ──────────────────
  // The render loop does not take the stride or source as live registers on every column; it re-reads them
  // from scratch. So the arm stashes the between-column stride into SCROLL_COPY_COLUMN_STRIDE (0x81b1) and
  // the tile-source base FROG_ANIM_ARM3_SRC_BASE (0x1453) into SCROLL_COPY_SRC_PTR (0x8001) before entering.
  mem8[SCROLL_COPY_COLUMN_STRIDE] = columnStride;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM3_SRC_BASE;

  // ── Enter the shared tile-column render loop ─────────────────────────────────────────
  // Hand off with arm 3's parameters. Both plot cursors (the IX/IY sprite-object cursors) point at the SAME
  // base, LANE_OBJLIST_811B (0x811b) — arm 3's scanned lane list — so the loop stamps this lane's tiles and
  // rewrites its object list at once. This is a direct call, not a trampoline: its result is our result.
  return renderFrogAnimTileColumns(m, rowCount, columnCount, destPtr, FROG_ANIM_ARM3_SRC_BASE, LANE_OBJLIST_811B, LANE_OBJLIST_811B);
}
