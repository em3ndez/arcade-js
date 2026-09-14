// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2b, COORD_LIST_PTR_LO } from "./names.js";

/**
 * fetchCoordListEntryByCounter — read a coordinate-list entry by re-indexing off a counter. ROM 0x96ab.
 *
 * Role in the machine: Tempest's vector shapes are stored as coordinate lists reached through a zero-page
 * pointer (loc_2c, COORD_LIST_PTR_LO). Reading the "next" point is not a flat index — the code computes a
 * new offset from a running counter and a stride byte stored two entries back in the list, so the same
 * pointer can be walked with a wrapping cadence. These three entries are the read variants that feed the
 * shape-emit path.
 *
 * Behavior: this counter variant forms the seed index from loc_2b, decrementing it and wrapping it into the
 * low nibble ((loc_2b-1)&0x0f) then +1, and hands that to the shared body. The Index sibling passes the raw
 * loc_2b instead. body stashes the caller's Y at loc_29, then subtracts the list byte two entries back
 * (pointer + (Y-2)) from the seed, adds the saved Y back in, re-indexes the pointer by that result, and
 * returns both the loaded entry (in A) and the computed offset (in Y). readCoordListEntry is the bare read:
 * pointer + Y with no arithmetic.
 *
 * Live-out: m.regs.a = the loaded entry byte; m.regs.y = the re-indexed offset (for the counter/index
 * variants); loc_29 holds the stashed Y. Grounding: [seen].
 */
// Coordinate helper over a vector list through the zero-page pointer: stash the incoming
// cursor, combine a counter-derived (or raw) value with the delta two entries back, then
// re-index by the result and load the entry it points to.
export function fetchCoordListEntryByCounter(m, y = m.regs.y) {
  const { mem8 } = m;
  return body(m, ((mem8[loc_2b] - 1) & 0x0f) + 1, y); // seed = decrement loc_2b, wrap to low nibble, +1
}

// Sibling: same re-index arithmetic but seeded from the raw counter loc_2b (no nibble wrap).
export function fetchCoordListEntryByIndex(m, y = m.regs.y) {
  const { mem8 } = m;
  return body(m, mem8[loc_2b], y);
}

// Shared re-index core: seed minus the stride byte two entries back, plus the saved Y, then load.
function body(m, a, y) {
  const { mem8, mem16 } = m;
  mem8[loc_29] = y;                            // stash the incoming cursor
  const ptr = mem16[COORD_LIST_PTR_LO];
  a = u8(a - mem8[u16(ptr + u8(y - 2))]);       // subtract the stride byte two entries back
  a = u8(a + mem8[loc_29]);                     // add the saved Y back in
  return [(m.regs.a = mem8[u16(ptr + a)]), (m.regs.y = a)]; // load entry -> A, offset -> Y
}

// Bare read: the entry at pointer + Y, no index arithmetic.
export function readCoordListEntry(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  return (m.regs.a = mem8[u16(mem16[COORD_LIST_PTR_LO] + y)]);
}
