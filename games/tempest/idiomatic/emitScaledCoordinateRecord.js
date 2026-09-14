// SPDX-License-Identifier: GPL-3.0-only
import { VEC_DELTA_Y_LO, DRAW_DELTA_A_HI, DRAW_DELTA_B_LO, DRAW_DELTA_B_HI } from "./names.js";
import { emitCoordinateRecord } from "./emitCoordinateRecord.js";

/**
 * emitScaledCoordinateRecord — widen two coordinates ×4 and emit the vector record they anchor. ROM 0xdf75.
 *
 * Role in the machine: coordinates handed to the draw pipeline are often small signed bytes that need to
 * be expressed as the vector generator's 16-bit signed deltas at a coarser scale. This routine multiplies
 * each of the two inputs by four (a left shift of two) with correct sign extension, deposits them into the
 * adjacent little-endian delta pairs, and emits the coordinate record built from those cells.
 *
 * scale4(v): reproduces the 6502 double-ASL. low = (v<<2)&0xff is the low byte; high carries the two bits
 * shifted out of the top of v — bit6 of v becomes bit0 of the high byte — OR'd with a sign fill (0xff when
 * v's sign bit is set, else 0x00) shifted up, so a negative input widens to a negative 16-bit delta.
 *
 * Behavior: scales a into the first pair VEC_DELTA_Y_LO/DRAW_DELTA_A_HI ($6e/$6f) and x into the second
 * pair DRAW_DELTA_B_LO/DRAW_DELTA_B_HI ($70/$71), then calls emitCoordinateRecord anchored at
 * VEC_DELTA_Y_LO to write the four-byte coordinate record through the draw cursor loc_74.
 *
 * Live-out: the two delta pairs $6e/$6f and $70/$71, the emitted coordinate record, and the advanced draw
 * cursor loc_74. Grounding: [seen].
 */
function scale4(v) {
  // Sign fill for the high byte: all-ones when v is negative, else zero.
  const signHi = v & 0x80 ? 0xff : 0x00;
  // Low byte is v shifted left twice, truncated to 8 bits.
  const low = (v << 2) & 0xff;
  // High byte: sign fill shifted up, OR the bit shifted out of v's top (bit6 -> bit0).
  const high = ((signHi << 1) | ((v >> 6) & 1)) & 0xff;
  return [low, high];
}

export function emitScaledCoordinateRecord(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  // First coordinate (a) widened into the Y delta pair $6e/$6f.
  [mem8[VEC_DELTA_Y_LO], mem8[DRAW_DELTA_A_HI]] = scale4(a);
  // Second coordinate (x) widened into the second delta pair $70/$71.
  [mem8[DRAW_DELTA_B_LO], mem8[DRAW_DELTA_B_HI]] = scale4(x);
  // Emit the coordinate record anchored at the first pair.
  return emitCoordinateRecord(m, VEC_DELTA_Y_LO);
}
