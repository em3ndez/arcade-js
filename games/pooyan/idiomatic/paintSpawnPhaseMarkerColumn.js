// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blitTile3x3Block } from "./blitTile3x3Block.js";
import {
  ROUND_COUNTER,
  SPAWN_PHASE_COUNTER,
  SPAWN_PHASE_SNAPSHOT,
  ROPE_DRAW_COUNT,
  MARKER_LAYOUT_PTR,
  MARKER_VRAM_BASE,
  MARKER_GLYPH_SRC,
} from "./names.js";
/**
 * paintSpawnPhaseMarkerColumn — draw the on-screen "round marker".  ROM 0x4a0b-0x4a4f.  [seen]
 *
 * WHAT IT IS
 *   One of the per-frame column drivers of the active round.  It renders a small marker into the
 *   tilemap that reflects how far the round's spawn-phase counter has advanced: a vertical stack
 *   of two-wide marker segments, one segment per phase step, capped off with a fixed 3x3 glyph
 *   block.  When the phase count is zero there is no stack — only the glyph, drawn at a fixed
 *   anchor.
 *
 * ROLE IN THE MACHINE
 *   The marker is a HUD-style readout of SPAWN_PHASE_COUNTER (0x8902), the per-round phase/step
 *   counter that cycles up to 7 selecting the round's spawn/fire mode.  Drawing it is gated on
 *   ROUND_COUNTER (0x8907) bit 0 — the same low bit that elsewhere selects the round's
 *   stage-type/facing variant — so the marker column is a feature of only the odd-bit variant of
 *   a round; on the even variant this routine paints nothing and leaves.
 *
 *   The routine also does double duty as the point where the phase count is latched for other
 *   consumers: it copies SPAWN_PHASE_COUNTER into two mirror cells (SPAWN_PHASE_SNAPSHOT 0x8d43
 *   and ROPE_DRAW_COUNT 0x8934, the count that sizes the rope/lift sprite rows) before it decides
 *   how to draw.
 *
 * LIVE-OUT (memory only)
 *   - SPAWN_PHASE_SNAPSHOT (0x8d43) and ROPE_DRAW_COUNT (0x8934): the snapshotted phase count.
 *   - MARKER_LAYOUT_PTR (0x8932): the saved video-RAM layout pointer for the marker column, which
 *     differs between the nonzero-count and zero-count layouts.
 *   - The painted marker tiles and the 3x3 glyph block in video RAM (0x86xx tilemap).
 *   The tile pointers left advanced in HL/DE by the glyph blitter are not consumed by any caller.
 */

// The marker "segment" is a 2x2 tile square: two tiles wide, two screen rows tall.  These are the
// four tile codes for its cells, one screen row (MARKER_ROW_STRIDE) apart in video RAM.
const TILE_MARKER_TL = 0xda;
const TILE_MARKER_TR = 0xdb;
const TILE_MARKER_BL = 0xd8;
const TILE_MARKER_BR = 0xd9;
// Video RAM is a 32-cell-wide grid, so cells one screen row apart differ by 0x20 addresses.
const MARKER_ROW_STRIDE = 0x20;
// Distance from the column's end cell back to the 3x3 glyph's top-left anchor: 0x40 (two screen
// rows) + 1 column, i.e. the glyph is stamped just past the bottom of the stacked column.
const MARKER_TAIL_OFFSET = 0x41;

export function paintSpawnPhaseMarkerColumn(m) {
  const { mem8, mem16 } = m;

  // Gate: draw the marker only on the round variant whose ROUND_COUNTER (0x8907) low bit is set.
  // Bit 0 selects the round's stage-type/facing variant; when it is clear this feature is absent
  // and the routine paints nothing.
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return; // feature bit clear

  // Latch the current spawn-phase count and mirror it into the two snapshot cells.  ROPE_DRAW_COUNT
  // (0x8934) is written alongside SPAWN_PHASE_SNAPSHOT (0x8d43) so the rope/lift renderer sizes its
  // sprite rows from the same value the marker is about to draw.
  const count = mem8[SPAWN_PHASE_COUNTER];
  mem8[SPAWN_PHASE_SNAPSHOT] = count;
  mem8[ROPE_DRAW_COUNT] = count;

  if (count !== 0) {
    // Nonzero count: draw a stack of `count` marker segments.
    // Save the column's layout pointer one screen row above the base (MARKER_VRAM_BASE - 0x20 =
    // 0x86a3) into MARKER_LAYOUT_PTR (0x8932); this is the pointer other code reads back to locate
    // the stacked layout.
    mem16[MARKER_LAYOUT_PTR] = MARKER_VRAM_BASE - MARKER_ROW_STRIDE;
    // Start the paint cursor at the column base cell (0x86c3, the marker column's top-left).
    let cell = MARKER_VRAM_BASE;
    let row = count;
    do {
      // Paint one 2x2 marker segment.  Top row of the segment at the cursor: TL then TR in the two
      // side-by-side cells.
      mem8[cell] = TILE_MARKER_TL;
      mem8[cell + 1] = TILE_MARKER_TR;
      // Bottom row of the segment one screen row away (one stride toward lower addresses): BL then
      // BR in the two side-by-side cells.
      const lower = cell - MARKER_ROW_STRIDE;
      mem8[lower] = TILE_MARKER_BL;
      mem8[lower + 1] = TILE_MARKER_BR;
      // Step the cursor to the next segment's base: another stride past the segment's second row,
      // so the cursor advances by 0x40 (two screen rows) per segment, stacking the column.
      cell = lower - MARKER_ROW_STRIDE;
      row -= 1;
    } while (row !== 0);
    // Cap the column with the fixed 3x3 glyph block, stamped from MARKER_GLYPH_SRC (ROM 0x2754)
    // at MARKER_TAIL_OFFSET (0x41) past the final cursor — just beyond the bottom of the stack.
    blitTile3x3Block(m, u16(cell - MARKER_TAIL_OFFSET), MARKER_GLYPH_SRC);
    return;
  }

  // Zero count: no segment stack.  Save the alternate layout pointer one screen row below the base
  // (MARKER_VRAM_BASE + 0x20 = 0x86e3) and stamp only the 3x3 glyph, at the fixed count-0 anchor
  // one tail-offset before the base (MARKER_VRAM_BASE - 0x41 = 0x8682).
  mem16[MARKER_LAYOUT_PTR] = MARKER_VRAM_BASE + MARKER_ROW_STRIDE;
  blitTile3x3Block(m, MARKER_VRAM_BASE - MARKER_TAIL_OFFSET, MARKER_GLYPH_SRC);
}
