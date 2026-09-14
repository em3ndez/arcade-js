// SPDX-License-Identifier: GPL-3.0-only
import { VG_RECORD_HEADER } from "./names.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";

/**
 * emitKeyedScaledCoordinateRecord — key a scaled-coordinate record with a caller index byte. ROM 0xdf73.
 *
 * Role in the machine: a thin front onto the scaled-coordinate emitter used when the vector record being
 * laid down needs to carry an identifying "key" byte in its header — for example the colour-pair emit at
 * the tail of the pot/spinner readout list, which passes Y = 0xc0 as the record's leading key. The scaled
 * record itself carries a display position; this entry just stamps the header key first so the drawn item
 * is tagged before its two coordinates are scaled and appended.
 *
 * Behaviour: write the incoming index/key byte Y into the shared record-header cell VG_RECORD_HEADER
 * (loc_73), then tail-delegate to emitScaledCoordinateRecord with the two coordinate operands (A, X). All
 * three registers default from m.regs so a bare call mirrors the 6502 entry, which arrives with Y/A/X live.
 *
 * Live-out: VG_RECORD_HEADER (loc_73) holds the key byte; the appended scaled record and its cursor
 * advance are done by the delegate. Grounding: [seen].
 */
export function emitKeyedScaledCoordinateRecord(m, y = m.regs.y, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[VG_RECORD_HEADER] = y;                 // stash the record's key/index byte into loc_73
  return emitScaledCoordinateRecord(m, a, x); // then scale (A,X) into the coordinate work pair and emit
}
