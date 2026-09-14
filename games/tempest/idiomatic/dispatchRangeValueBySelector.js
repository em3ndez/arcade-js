// SPDX-License-Identifier: GPL-3.0-only
import { COORD_DISPATCH_SEL } from "./names.js";
import { fetchCoordListEntryByCounter, fetchCoordListEntryByIndex, readCoordListEntry } from "./fetchCoordListEntryByCounter.js";
import { sumCoordListEntryRun } from "./sumCoordListEntryRun.js";
import { resolveCoordListEntryToAbsolute } from "./resolveCoordListEntryToAbsolute.js";
import { selectListEntryByDeltaParity } from "./computeCoordListBackDelta.js";

/**
 * dispatchRangeValueBySelector — resolve one range-bracketed coordinate-list value. ROM 0x9677.
 *
 * Role in the machine: the state re-seed at loc_92c5 walks a table of packed coordinate records and,
 * for each, has to pull a single byte out of a source list. Which flavour of list it is — a raw entry,
 * an indexed entry, a counted run, an absolute-resolved entry, or a parity-selected entry — is not fixed
 * by the record; it is chosen at run time by a mode byte the walk left in the selector cell. This routine
 * is the 6502 computed-JMP that turns that mode byte into the right helper call.
 *
 * Behaviour: read the even selector byte COORD_DISPATCH_SEL (0x15e), halve it (>>1) to index the jump
 * table, and tail-call the matching 0x96xx coordinate helper, threading Y (the caller's list index/count)
 * through unchanged. Legal selector values are 2,4,6,8,10,12; each maps to loc_96c4/96b7/96ab/96e2/96db/
 * 9700 respectively. Slot 0 is `null` — selector 0 is never emitted by loc_92c5, so the table entry is a
 * placeholder that keeps the >>1 index aligned to the ROM's byte-per-2 layout.
 *
 * Live-out: none of its own — it returns the selected helper's byte straight to loc_92c5's table walk,
 * which stores it through the record's destination pointer. Grounding: [seen].
 */
const TABLE = [null, readCoordListEntry, fetchCoordListEntryByIndex, fetchCoordListEntryByCounter, sumCoordListEntryRun, resolveCoordListEntryToAbsolute, selectListEntryByDeltaParity];

export function dispatchRangeValueBySelector(m, y = m.regs.y) {
  const { mem8 } = m;
  // Halve the even selector (0x15e) to an entry index and tail-return the helper's byte, Y threaded through.
  return TABLE[mem8[COORD_DISPATCH_SEL] >> 1](m, y);
}
