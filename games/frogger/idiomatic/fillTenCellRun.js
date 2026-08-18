// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTenCellRun  —  ROM 0x0779  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A ten-cell tilemap fill. It stamps one tile — the blank-field marker 0x10 — into ten consecutive
 *   tilemap cells, starting at a base address the caller hands over in HL. In the ROM this is a tiny
 *   djnz loop: BC is loaded with 0x0a10, which packs the run length (B = 0x0a = 10) into the high byte
 *   and the tile to write (C = 0x10) into the low byte; the loop then does `ld (hl),c` / `inc hl` /
 *   `djnz` until B counts down to zero.
 *
 * WHERE IT SITS
 *   The horizontal-run helper of clearAndSeedScoreField, which repaints the whole score field for a
 *   new board — 0x20 rows, each row two ten-cell runs split by a two-cell gap. That caller invokes
 *   this routine twice per row (once for each run), stepping the base down one row between passes.
 *   Nothing else in the port calls it. Score-field setup is never reached by plain attract, so this is
 *   exercised by the crafted-entry equivalence test at ROM 0x0779, not by attract frames.
 *
 * LIVE-OUT
 *   Memory — the ten tile cells — plus TWO registers the caller's dispatch reads back afterwards:
 *   HL is left pointing just past the run (base + 10, where the ROM's `inc hl` leaves it) and the loop
 *   counter B is drained to 0. (The ROM also leaves C holding the fill tile 0x10 as a side effect of
 *   packing BC; the rewrite does not reproduce C because nothing downstream reads it, and the
 *   equivalence oracle checks only RAM, HL and B.)
 */

// BC in the ROM is the packed constant 0x0a10: high byte is the run length (B, the djnz counter) and
// low byte is the tile written into every cell (C). We carry the two halves as named constants.
const FILL_TILE = 16; // 0x10 — the blank-field marker tile the score field is seeded with
const RUN = 10;       // 0x0a — cells per run; the ROM's djnz counter starts here and drains to 0

export function fillTenCellRun(m, base = m.regs.hl) {
  const { mem8 } = m;

  // ── Stamp the run ────────────────────────────────────────────────────────────────────
  // Walk ten consecutive tilemap cells from `base` (the caller's HL) and write the fill tile into
  // each one. The ROM expresses this as `ld (hl),c` / `inc hl` / `djnz`, counting B down from 10;
  // the loop below counts up from 0 instead, but touches the exact same ten cells with the exact
  // same tile, and leaves the write pointer one past the last cell — matching the ROM's `inc hl`.
  let writePtr = base;
  for (let i = 0; i < RUN; i++) {
    mem8[writePtr] = FILL_TILE;
    writePtr++;
  }

  // ── Hand back the drained registers ───────────────────────────────────────────────────
  // The caller's dispatch reads HL and B once this returns: HL must point just past the run (base +
  // 10) and the djnz counter B must be fully drained to 0. We publish both by assigning m.regs.*
  // inside the returned pair — the assignments are the load-bearing part; the array is the shape the
  // translated dispatch expects.
  return [(m.regs.hl = writePtr), (m.regs.b = 0)];
}
