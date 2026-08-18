// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm4  —  ROM 0x10bb  ·  grounding: [code]
 *
 * WHAT IT IS
 *   Render arm 4 of Frogger's eleven-arm frog-animation pipeline. Every frame the play scene is redrawn,
 *   `dispatchFrogAnimationArm` (0x0faf) reads the animation-index cell (0x8000) and jumps to one of eleven
 *   near-identical "arms," each of which repaints one lane's sprite objects. This is arm 4, a plain member
 *   of the family: no pre-blit (only arm 1 has one), parameters at the head of its own triple. Like every
 *   arm it does almost no work itself — it reads a small per-arm parameter block, parks two values in the
 *   scratch cells the shared render loop rereads, then hands off to that loop. It is the code-level sibling
 *   of the MAME-grounded arm 0 (renderFrogAnimArm0, [seen]); the two are structurally identical, so arm 0's
 *   grounding carries the shape here while arm 4's own MAME grounding is still pending.
 *
 *   One quirk sets arm 4 apart on paper: its ROM pointer cells are named for the SCROLL subsystem, not for
 *   "arm 4." Arm 4's slot in the per-arm ROM destination table (0x13f5) is the very word the scroll-copy
 *   engine's alternate entry reads, so it is aliased as SCROLL_COPY_DEST_PTR_ALT; and arm 4's tile-source
 *   base (0x145f) is aliased as SCROLL_BAND_SRC_PHASE16, the phase-16 scroll-band source. Same cells, two
 *   names — the "scroll" spelling is just the one those shared ROM words were first named for.
 *
 * WHERE IT SITS
 *   Called by `dispatchFrogAnimationArm` when the animation index selects arm 4. Because the shared loop
 *   tail-recurses through `advanceFrogAnimIndexAndRedispatch`, one dispatch entry renders the current arm
 *   and every following arm in one sweep, repopulating all ten scanned lane object lists. Arm 4 owns lane
 *   nibble 7, whose object list is LANE_OBJLIST_8124 (0x8124): the very list the move resolver's band scan
 *   (loc_12e4, inside dispatchFrogMoveAgainstLanes) reads back to hit-test the frog. So this render and the
 *   collision test are two ends of one data structure — arm 4 writes the list, the resolver reads it.
 *
 * LIVE-OUT
 *   Memory only. It writes two scratch cells (column stride, source pointer), then the shared loop it
 *   tail-calls stamps VRAM and the lane object list. It returns nothing the caller reads.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8124,
  SCROLL_COPY_DEST_PTR_ALT,
  SCROLL_BAND_SRC_PHASE16,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm4(m) {
  const { mem8, mem16 } = m;

  // ── Read arm 4's parameter triple ────────────────────────────────────────────────────
  // ACTIVE_LANE_PARAM_BLOCK (0x8270) is a 33-byte block reloaded each life from the active player's
  // difficulty table by loadActivePlayerLaneParams, so board difficulty tunes every arm. The eleven arms'
  // triples are packed contiguously — arm k reads its triple at offset 3·k — so arm 4's begins at +12.
  //   +12 → the column stride: how far the destination advances between columns (stashed below).
  //   +13 → the row count: tile-pairs copied straight down each column.
  //   +14 → the column count: how many columns this arm stamps.
  const columnStride = mem8[ACTIVE_LANE_PARAM_BLOCK + 12];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 13];
  const columnCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 14];

  // ── Take arm 4's VRAM destination base ───────────────────────────────────────────────
  // Each arm's paint origin comes from a ROM pointer table at 0x13ed + 2·k. Arm 4's slot (0x13ed + 8 =
  // 0x13f5) is aliased as SCROLL_COPY_DEST_PTR_ALT because the scroll-copy engine's alternate entry reads
  // the same ROM word; read the 16-bit VRAM address the loop starts stamping at.
  const destPtr = mem16[SCROLL_COPY_DEST_PTR_ALT];

  // ── Park the two values the shared loop rereads per column ────────────────────────────
  // The render loop does not carry the stride or the source in registers across its column iterations; it
  // reloads them from scratch cells each pass. So stash the column stride into SCROLL_COPY_COLUMN_STRIDE
  // (0x81b1) — the loop adds it to the destination between columns — and arm 4's tile-source base
  // SCROLL_BAND_SRC_PHASE16 (0x145f, the phase-16 scroll-band source ROM word) into SCROLL_COPY_SRC_PTR
  // (0x8001), so every column restarts its row copy from the same source base.
  mem8[SCROLL_COPY_COLUMN_STRIDE] = columnStride;
  mem16[SCROLL_COPY_SRC_PTR] = SCROLL_BAND_SRC_PHASE16;

  // ── Enter the shared tile-column render loop ─────────────────────────────────────────
  // Hand over this arm's row count (rows per column), column count, VRAM destination, and tile source. The
  // last two args are the plot cursors — both seeded to LANE_OBJLIST_8124 (0x8124), arm 4's lane object
  // list. Inside the loop one cursor (IX) writes each column's negated index as the sprite X into the list,
  // the other (IY) bumps the list's leading count byte, building the [count, x0, x1, …] record the move
  // resolver reads back. This is a plain tail-call: the loop stamps every column then hands to
  // advanceFrogAnimIndexAndRedispatch, which steps to the next arm; nothing here runs afterward.
  return renderFrogAnimTileColumns(m, rowCount, columnCount, destPtr, SCROLL_BAND_SRC_PHASE16, LANE_OBJLIST_8124, LANE_OBJLIST_8124);
}
