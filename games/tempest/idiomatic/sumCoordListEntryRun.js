// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { COORD_LIST_PTR_LO } from "./names.js";
import { computeCoordListBackDelta } from "./computeCoordListBackDelta.js";

/**
 * sumCoordListEntryRun — sum a run of consecutive coordinate-list entries into one byte. ROM 0x96e2.
 *
 * Role in the machine: Tempest's tube geometry is stored as coordinate lists walked through an indirect
 * pointer. This helper totals a contiguous run of entries starting at offset Y: it asks a companion
 * routine how long the run is, then adds up that many entries and returns a single wrapped byte -- used
 * where the game needs the aggregate (e.g. a spanning length/offset) of a stretch of the current list
 * rather than the individual entries.
 *
 * Behavior: computeCoordListBackDelta ($96f4) supplies the repeat count for offset Y. The working list
 * base comes from the 16-bit indirect pointer COORD_LIST_PTR_LO ($002c). Seed the total with the first
 * entry (ptr + Y), advance Y once (wrapping in a byte) to point at the second entry, then, if the count is
 * nonzero, loop adding that same second entry into the total (masked to a byte) `count` times -- Y is not
 * advanced inside the loop, so it folds repeated copies of the one next entry, not a stride of entries.
 *
 * Live-out: none in memory -- this is a pure fold; it returns the one-byte sum (and reads, but does not
 * write, COORD_LIST_PTR_LO and the list). Grounding: [seen].
 */
export function sumCoordListEntryRun(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  let count = computeCoordListBackDelta(m, y); // how many further entries follow the first
  const ptr = mem16[COORD_LIST_PTR_LO]; // 16-bit base of the current coordinate list
  let sum = mem8[u16(ptr + y)]; // seed with the first selected entry
  y = (y + 1) & 0xff; // step once to the second entry (byte wrap); Y stays put after this
  if (count !== 0) {
    do {
      sum = (sum + mem8[u16(ptr + y)]) & 0xff; // add that same second entry each pass, wrapping to a byte
      count = (count - 1) & 0xff;
    } while (count !== 0);
  }
  return sum; // one-byte aggregate of the run
}
