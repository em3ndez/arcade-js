// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampScrollRevealColumn  —  ROM 0x20fb  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The reveal-column stamp for river-scroll "object A". Frogger paints its scrolling background
 *   incrementally: a free-running clock advances object A's phase counter every in-play frame, and
 *   at fixed phase marks this routine copies one narrow column of tiles out of a small ROM stamp
 *   table into the tilemap. Stacked frame after frame, those columns are what make the river's
 *   surface appear to scroll and "reveal" fresh tiles at the object's edge.
 *
 * WHERE IT SITS
 *   Called from the per-frame scroll driver advanceScrollLaneObjects (ROM 0x2005): after it bumps
 *   object A's counter SCROLL_STAMP_PHASE (0x8110) by +1, it fires this stamp once the counter has
 *   reached/passed 80. It is the object-A twin of blitScrollBand (0x219c, object B) and shares the
 *   tilemap that the bulk copy engine blitScrollTileGrid (0x20cc) also writes. Only three exact
 *   phase values below actually stamp; every other frame the dispatch falls through and the routine
 *   does nothing but rewrite the row-count mirror.
 *
 * LIVE-OUT
 *   Memory only. On a stamping frame it writes four rows of tile pairs into VRAM (via `stamp`) and,
 *   on two of the arms, toggles the edge flag SCROLL_EDGE_FLAG (0x8107). Every path finishes by
 *   writing the row-count mirror SCROLL_STAMP_ROWCOUNT (0x811a). It returns nothing.
 */
import { SCROLL_OBJECT_BLOCK_BASE, SCROLL_STAMP_PHASE, SCROLL_EDGE_FLAG, SCROLL_STAMP_ROWCOUNT, SCROLL_STAMP_TABLE_80_208, SCROLL_STAMP_TABLE_128_176, SCROLL_STAMP_TABLE_160, TILEMAP_FILL_BASE_22X32 } from "./names.js";

// One tilemap row is 32 tile cells wide, so stepping a VRAM pointer by +32 moves it straight down
// one row. This is both the column multiplier in the address build and the row pitch of the copy.
const ROW_PITCH = 32;

// The ROM stamp tables hold 2-byte tile PAIRS; advancing the source pointer by +2 steps to the next
// pair. (dest advances by ROW_PITCH; src advances by PAIR.)
const PAIR = 2;

// The copy stamps two column-pairs of two rows each — four rows total, 32-byte pitch apart.
const COLUMN_PAIRS = 2;
const ROWS_PER_STAMP = 2;

export function stampScrollRevealColumn(m) {
  const { mem8 } = m;

  // ── Read object A's 3-byte descriptor ────────────────────────────────────────────────────────
  // SCROLL_OBJECT_BLOCK_BASE (0x8273) is object A's descriptor: +0 is the row field, +1 the column
  // field, +2 the row count. mechanisms.md names +0/+1 the "row"/"column" field; note the address
  // build below multiplies the COLUMN field by the row pitch, so colField is what actually steps the
  // destination down the tilemap. Names follow the doc; the arithmetic is faithful to the ROM.
  const rowField = mem8[SCROLL_OBJECT_BLOCK_BASE];
  const colField = mem8[SCROLL_OBJECT_BLOCK_BASE + 1];
  const rowCount = mem8[SCROLL_OBJECT_BLOCK_BASE + 2];

  // ── Build the VRAM destination base ──────────────────────────────────────────────────────────
  // `step` = rowField + (32 * colField mod 256): the within-row offset plus `colField` whole rows,
  // wrapped to a byte just as the Z80's 8-bit add does. `span` scales that step by the object's
  // row count, with the ROM's two edge cases: a row count of 0 means 255 spans and 1 means 256
  // (the count byte behaving as "256 when zero" in the loop it mirrors), otherwise rowCount − 1.
  // Offsetting by the fixed tilemap fill base TILEMAP_FILL_BASE_22X32 (0xa808) lands the column in
  // the scrolling region of VRAM.
  const step = rowField + ((ROW_PITCH * colField) & 0xff);
  const span = rowCount === 0 ? 255 : rowCount === 1 ? 256 : rowCount - 1;
  const base = step * span + TILEMAP_FILL_BASE_22X32;

  // ── Dispatch on the scroll phase → pick a stamp table ────────────────────────────────────────
  // SCROLL_STAMP_PHASE (0x8110) is object A's free-running counter (the same value that gated this
  // call at ≥80). Three exact values each select a 4-byte ROM stamp table; the two flagged arms
  // also drive the edge flag SCROLL_EDGE_FLAG (0x8107) that marks where the reveal wraps. Any other
  // phase stamps nothing — the routine still falls through to rewrite the row-count mirror below.
  const phase = mem8[SCROLL_STAMP_PHASE];
  if (phase === 80 || phase === 208) {
    // Early/late-in-cycle reveal: stamp only, no edge toggle.
    stamp(base, SCROLL_STAMP_TABLE_80_208);
  } else if (phase === 128 || phase === 176) {
    // Mid-cycle reveal: stamp, then clear the edge flag. The ROM tests before clearing, so mirror
    // that guard exactly (only write when it is currently set) — behavior-preserving.
    stamp(base, SCROLL_STAMP_TABLE_128_176);
    if (mem8[SCROLL_EDGE_FLAG] !== 0) mem8[SCROLL_EDGE_FLAG] = 0;
  } else if (phase === 160) {
    // Edge reveal: stamp, then raise the edge flag to 1.
    stamp(base, SCROLL_STAMP_TABLE_160);
    mem8[SCROLL_EDGE_FLAG] = 1;
  }

  // ── Always: rewrite the row-count mirror ─────────────────────────────────────────────────────
  // SCROLL_STAMP_ROWCOUNT (0x811a) is object A's row-count shadow, which the scroll driver reads
  // back when it re-stamps the whole grid. Every path (even the no-op phases) leaves it holding
  // rowCount − 1, matching the ROM's unconditional final store.
  mem8[SCROLL_STAMP_ROWCOUNT] = rowCount - 1;

  // Copy the reveal column: four VRAM rows starting at `start`, 32 bytes (one tilemap row) apart,
  // sourced from the 4-byte ROM `table`. It runs as two column-pairs of two rows: `dest` walks
  // straight down VRAM and is NOT reset between pairs, but `src` restarts at `table` on each pair —
  // so the four rows read table pairs [0,1],[2,3] and then [0,1],[2,3] again.
  function stamp(start, table) {
    let dest = start;
    for (let cp = 0; cp < COLUMN_PAIRS; cp++) {
      let src = table;
      for (let row = 0; row < ROWS_PER_STAMP; row++) {
        mem8[dest] = mem8[src];
        mem8[dest + 1] = mem8[src + 1];
        dest = dest + ROW_PITCH;
        src = src + PAIR;
      }
    }
  }
}
