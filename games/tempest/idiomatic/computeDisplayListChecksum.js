// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { BONUS_LIFE_INTERVAL, PROJ_PT_X, PROJ_PT_Y, OBJ_DEPTH, CHECKSUM_ACC, VECLIST_CKSUM_SRC } from "./names.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

/**
 * computeDisplayListChecksum — publish the object-list gate checksum (and an optional flag record). ROM 0xaeca.
 *
 * Role in the machine: Tempest guards its object display list with a running checksum so that
 * buildObjectDisplayList can tell whether the vector list it is about to hand the display processor is intact
 * (an end-of-list gate). This routine recomputes that byte every frame from a fixed 17-byte source span and
 * stores it where the list builder reads it. As a side errand it draws the bonus-life "flag" record when a
 * bonus interval is armed, so the marker shows on screen.
 *
 * Behavior: read BONUS_LIFE_INTERVAL ($156). If nonzero, seat that value into PROJ_PT_X ($58), open a shape
 * record (drawSlotShapeRecord slot 0x34), zero the coordinate pair PROJ_PT_Y/$56 and OBJ_DEPTH/$57, and emit
 * a short numeric run (emitNibbleDigitRun 0x56, len 0x03). Then, unconditionally, fold the seventeen bytes at
 * VECLIST_CKSUM_SRC ($d575), indices 0x10 down to 0, into an accumulator seeded 0x85 using an 8-bit add-with-
 * carry chain (matching the 6502 ADC), and store the low byte into CHECKSUM_ACC ($b5).
 *
 * Live-out: CHECKSUM_ACC ($b5) := folded checksum (the gate buildObjectDisplayList reads); when the flag was
 * armed, PROJ_PT_X/$56/$57 written and two records emitted. Returns the checksum. Grounding: [seen].
 */
export function computeDisplayListChecksum(m) {
  const { mem8 } = m;
  const flag = mem8[BONUS_LIFE_INTERVAL];   // bonus-life interval; nonzero -> draw the flag marker
  if (flag !== 0) {
    mem8[PROJ_PT_X] = flag;                 // seat the interval as the record's X ($58)
    drawSlotShapeRecord(m, 0x34);           // open the flag shape record
    mem8[PROJ_PT_Y] = 0x00;                 // cleared coordinate pair ($56/$57)
    mem8[OBJ_DEPTH] = 0x00;
    emitNibbleDigitRun(m, 0x56, 0x03);      // emit the 3-entry numeric run
  }
  // Fold the fixed 17-byte source span into one checksum byte, 6502 ADC-with-carry, seeded 0x85.
  let acc = 0x85;
  let carry = 0;
  for (let y = 0x10; y >= 0; y--) {
    const sum = acc + mem8[u16(VECLIST_CKSUM_SRC + y)] + carry;
    acc = sum & 0xff;                       // keep the low byte
    carry = sum > 0xff ? 1 : 0;             // propagate the carry-out
  }
  mem8[CHECKSUM_ACC] = acc;                 // publish to the end-of-list gate cell $b5
  return acc;
}
