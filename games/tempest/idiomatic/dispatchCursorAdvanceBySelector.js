// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { COORD_DISPATCH_SEL, DISPATCH_PTR_LO_TABLE } from "./names.js";
import { advanceCursorPastPackedRecord, advanceListCursorByTwo } from "./advanceCursorPastPackedRecord.js";
import { advanceCoordListByEntryStride } from "./advanceCoordListByEntryStride.js";

/**
 * dispatchCursorAdvanceBySelector -- advance the source-list cursor via a computed jump. ROM 0x9683.
 *
 * Role in the machine: Tempest builds its shape/coordinate output by walking packed source lists.
 * reseedStateTables scans those lists record-by-record looking for the range that brackets a search key,
 * and each step it must move the read cursor forward past the current entry. The step size depends on the
 * list's format, so the original picks the right advance helper through a computed (RTS-trampoline) jump
 * keyed off the current selector. That jump is dissolved here into a direct table select.
 *
 * Behavior: COORD_DISPATCH_SEL (0x15e) is an even byte index into a fixed handler set. Before dispatching,
 * A is seated to the low byte of the selected pointer read from DISPATCH_PTR_LO_TABLE + index -- the two
 * Y-only advance helpers (advanceListCursorByTwo, advanceCoordListByEntryStride) leave A untouched, so this
 * seed is what their callers read back in A. The chosen handler at TABLE[index>>1] is tail-called with Y
 * and consumes this routine's own caller's return. advanceCursorPastPackedRecord (0x96cb) returns a
 * [a, advancedY] pair (it computes its own A); the Y-only handlers return just the advanced Y scalar.
 *
 * Live-out: the advanced cursor Y and register A (either the pointer-low seed or the packed handler's own A).
 * Grounding: [seen].
 */
const TABLE = [null, advanceListCursorByTwo, advanceCoordListByEntryStride, advanceCoordListByEntryStride, advanceCursorPastPackedRecord, advanceListCursorByTwo, advanceCursorPastPackedRecord];

export function dispatchCursorAdvanceBySelector(m, y = m.regs.y) {
  const { mem8 } = m;
  const index = mem8[COORD_DISPATCH_SEL];
  const aSeed = mem8[u16(DISPATCH_PTR_LO_TABLE + index)]; // low pointer byte; A live-out on the Y-only handlers
  const r = TABLE[index >> 1](m, y);
  // 96cb returns [a, advancedY]; the Y-only handlers return the advanced Y scalar (A stays the seed).
  if (Array.isArray(r)) return [(m.regs.a = r[0]), r[1]];
  return [(m.regs.a = aSeed), r];
}
