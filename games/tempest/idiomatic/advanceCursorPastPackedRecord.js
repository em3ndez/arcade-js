// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";

/**
 * advanceCursorPastPackedRecord — cursor-skip helper. ROM 0x96c7 (advance the list cursor past a packed record).
 *
 * Role in the machine: Tempest walks packed coordinate/state lists (the source tables reseeded and
 * scanned by reseedStateTables) with a Y cursor. When the walker only needs to STEP OVER a record --
 * skip a packed entry it is not interested in reading -- it calls one of the 0x96xx cursor-advance
 * helpers via dispatchCursorAdvanceBySelector, which uses the COORD_DISPATCH_SEL selector to pick the
 * right stride and tail-calls it. This is the "skip a packed record" stride: it moves the cursor forward
 * by a fixed run without touching the record's bytes, so the next walker read lands on the following
 * record.
 *
 * Behavior: two entry points share one fall-through. The first entry (advanceCursorPastPackedRecord)
 * bumps Y by one and falls into the second entry, which adds two more -- a net advance of three. The
 * second entry (advanceListCursorByTwo) is also called on its own to step past a two-byte record, adding
 * exactly two. Everything is done in the Y cursor register; no memory cell is read or written. Off the
 * real 6502 A is left untouched, which is why the dispatcher pre-seats A with the pointer low byte for
 * these Y-only handlers.
 *
 * Live-out: the updated list cursor in m.regs.y (Y advanced by three from the first entry, by two from the
 * second). No memory writes. Grounding: [code].
 */
export function advanceCursorPastPackedRecord(m, y = m.regs.y) {
  // First entry: bump the cursor by one, then fall into the +2 helper for a net stride of three.
  return advanceListCursorByTwo(m, u8(y + 1));
}

// Second entry / standalone: advance the list cursor past a two-byte record by adding two to Y and
// committing it back to the cursor register. Register only -- writes no memory.
export function advanceListCursorByTwo(m, y = m.regs.y) {
  return (m.regs.y = u8(y + 2));
}
