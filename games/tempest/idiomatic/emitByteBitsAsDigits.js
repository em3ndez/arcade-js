// SPDX-License-Identifier: GPL-3.0-only
import { SAVED_INDEX, SLOT_LOOP_INDEX } from "./names.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitStrokeWordFromNibblePlusOne } from "./emitStrokeWordFromNibblePlusOne.js";

/**
 * emitByteBitsAsDigits — draw a byte as eight per-bit vector strokes, MSB first. ROM 0xdd2b.
 *
 * Role in the machine: some Tempest displays (notably self-test / bookkeeping bit fields) show a byte
 * as a row of eight marks, one per bit. This positions the row on screen and then walks the byte from
 * its high bit down to its low bit, emitting a stroke word for each bit whose shape encodes 0 or 1.
 *
 * Behavior: stashes the byte-to-draw (Y) into the scratch cell SAVED_INDEX (loc_35); places the row by
 * scaling coordinates (A, X) into the vector work pair via emitScaledCoordinateRecord; then loops eight
 * times (SLOT_LOOP_INDEX 7 down through 0, the `< 0x80` guard catching the 0->0xff underflow). Each pass
 * left-shifts SAVED_INDEX by one and reads the bit shifted out of bit 7 ((shifted >> 8) & 1) — so bits
 * emerge MSB-first — and passes that bit to emitStrokeWordFromNibblePlusOne, which emits one stroke word.
 *
 * Live-out: eight stroke words appended to the draw stream; SAVED_INDEX left shifted-out (zero after a
 * full byte); A (register) holds the cursor value returned by the last stroke emit. Grounding: [seen].
 */
export function emitByteBitsAsDigits(m, y = m.regs.y, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SAVED_INDEX] = y;                    // byte to render, held in scratch loc_35
  emitScaledCoordinateRecord(m, a, x);      // position the eight-bit row on screen
  mem8[SLOT_LOOP_INDEX] = 0x07;             // eight bits: index 7..0
  let a2;
  do {
    const shifted = mem8[SAVED_INDEX] << 1; // shift the top bit out into bit 8
    mem8[SAVED_INDEX] = shifted;
    a2 = emitStrokeWordFromNibblePlusOne(m, (shifted >> 8) & 1);  // emit that (MSB-first) bit
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);   // stop when the counter underflows past 0
  // Exit A (live-out) is the cursor value left by the eighth (last) digit emit.
  return (m.regs.a = a2);
}
