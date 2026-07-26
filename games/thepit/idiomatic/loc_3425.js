// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3425 — a two-stage tile-table probe: does the tile one row on from the
 * object's current cell (and, conditionally, the one beside it) belong to the
 * table rows keyed by the object's sub-tile phase?  ROM 0x3425.
 *
 * This is one of four sibling probes (the others sit at 0x33bc/0x33da/0x3410) that
 * the per-object move/collision driver chains: it tries each probe in turn and, on
 * the first that reports a match, hands the object to a movement handler. loc_3425's
 * job here:
 *   - Take the object's current tilemap pointer, advance it by 32 (one row down in
 *     the 32-column tilemap), and stash that advanced pointer at 0x8134 — the probe
 *     re-reads it below.
 *   - Look up whether the tile now under that advanced pointer appears anywhere in
 *     the first table's 32-entry row, the row chosen by the object's sub-tile phase.
 *     If it does not, the probe fails.
 *   - When it does match AND the phase is nonzero, tighten the test: the tile
 *     immediately after the advanced pointer must also appear in the second table's
 *     row (chosen by the phase shifted the other way). The probe's result is then
 *     that second lookup. A zero phase skips this and reports the first match.
 *
 * The phase indexes both table rows with a byte-wide wrap, so a large phase folds
 * back to a low row. Both table rows live in ROM (fixed valid-tile lists); the two
 * probed tiles live in the tilemap the pointer at 0x8089 addresses.
 *
 * Reads the phase (0x808d) and the pointer (0x8089), writes only the advanced
 * pointer (0x8134), and reports its match result. The name stays neutral: the
 * probe's exact directional meaning and what the two ROM tables encode are not yet
 * pinned to the confidence an English name would claim.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3425.test.js.
 * GATE:     real captured dispatches — the attract demo enters 0x3425 ~176x, spanning
 *           the first-row miss and zero-phase exits; a crafted grid then pokes the probe
 *           bytes to also cover the byte-wrap seams and force the both-rows-scanned exit
 *           on demand, identically on both sides. Teeth on the pointer write and on the
 *           second-row phase shift.
 * LIVE-OUT: memory (the advanced pointer at 0x8134) + the match flag the still-oracle
 *           caller loc_319d branches on. Also returned as a boolean for a future
 *           direct-call caller. Every other register/flag it leaves is dead ABI.
 * NAMES:    none in ram.js for this routine's addresses — 0x808d (object sub-tile
 *           phase), 0x8089 (object tilemap pointer), 0x8134 (the advanced-pointer
 *           scratch) all stay hex; their roles are described but not yet grounded.
 */

import { F_Z } from "../../../core/cpu/z80.js";

const FIRST_TABLE = 0x34fe; // base of the first valid-tile table (rows of 32)
const SECOND_TABLE = 0x35fe; // base of the second valid-tile table (rows of 32)
const ROW_LEN = 32; // entries per table row / the pointer's one-row stride

/** Whether `key` appears anywhere in the 32-entry table row starting at `base`. */
function rowContains(mem, base, key) {
  for (let i = 0; i < ROW_LEN; i++) {
    if (mem.read8(base + i) === key) return true;
  }
  return false;
}

export function loc_3425(m) {
  const { mem, regs } = m;

  const phase = mem.read8(0x808d);
  // Advance the object's tilemap pointer one row and stash it for the reload below.
  const cell = (mem.read16(0x8089) + ROW_LEN) & 0xffff;
  mem.write16(0x8134, cell);

  // First row (selected by the phase, wrapping within a byte): must contain the
  // tile now under the advanced pointer, or the probe fails outright.
  let matched = rowContains(mem, FIRST_TABLE + (phase + ROW_LEN) % 256, mem.read8(cell));

  // With a nonzero phase, also require the following tile to be in the second
  // row (phase shifted the other way). A zero phase reports the first match as-is.
  if (matched && phase !== 0) {
    matched = rowContains(
      mem,
      SECOND_TABLE + (phase - ROW_LEN + 256) % 256,
      mem.read8((cell + 1) & 0xffff),
    );
  }

  // Report the match to the still-oracle caller through the flag it tests, and
  // return it for a future direct-call caller.
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z;
  return matched;
}
