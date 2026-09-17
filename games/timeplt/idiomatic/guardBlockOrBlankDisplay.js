// SPDX-License-Identifier: GPL-3.0-only
/** guardBlockOrBlankDisplay — let the sequence move on only if a block of the program image still adds up.
 * A running eight-bit total is seeded from one program byte and fifty-one more added. When it is
 * the one expected, the inner sequence index is stepped; the accumulator keeps the matching total
 * and the loop counter its exhausted zero. Otherwise the display is switched off through the output
 * latch — the written value taken from a program byte too — and one character cell is copied into a
 * pair of work cells (glyph then the colour beside it); that arm leaves the sequence index put, so
 * nothing after it runs, and hands back the colour byte, a spent counter, the destination cursor
 * just past the pair, the source cursor on the colour cell, and the flags the final compare set.
 * LIVE-OUT: memory, plus the accumulator/counter and (on the blank arm) the two cursors and flags. */

import { u8 } from "../../../core/int.js";
import { F_C, F_F3, F_F5, F_H, F_N, F_PV, F_S, F_Z } from "../../../core/cpu/z80.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { TAMPER_WITNESS, stampCopyrightStrip_ADDR, COPYRIGHT_STRIP_CHECK_SEED, DISPLAY_OFF_VALUE, VIDEO_ENABLE_LATCH, TAMPER_WITNESS_SAMPLE_CELL } from "./names.js";

const GUARDED_BYTES = 51;
const EXPECTED_TOTAL = 239;
const LATCH_WRITE_OFFSET = 10;
const CHARACTER_PLANE_BIT = 1 << 10;

// The flags the compare-with-expected leaves on the blank arm: sign and undocumented bits from the
// low byte of (total - expected), zero when they are equal (never, here), the undocumented pair from
// the expected value, subtract set, carry on an unsigned borrow, half-carry on a nibble borrow, and
// overflow on a signed borrow.
const compareFlags = (total) => {
  const r = total - EXPECTED_TOTAL;
  const res = r & 0xff;
  return (res & 0x80 ? F_S : 0) | (res === 0 ? F_Z : 0) | (EXPECTED_TOTAL & (F_F3 | F_F5)) | F_N |
    (r < 0 ? F_C : 0) | (((total ^ EXPECTED_TOTAL ^ res) & 0x10) ? F_H : 0) |
    (((total ^ EXPECTED_TOTAL) & (total ^ res) & 0x80) ? F_PV : 0);
};

export function guardBlockOrBlankDisplay(m) {
  const { mem8 } = m;
  let total = mem8[COPYRIGHT_STRIP_CHECK_SEED];
  for (let i = 0; i < GUARDED_BYTES; i++) total = u8(total + mem8[stampCopyrightStrip_ADDR + i]);

  if (total === EXPECTED_TOTAL) return (m.regs.a = total, m.regs.b = 0, advanceSequenceSubStep(m));

  m.mem.write8(VIDEO_ENABLE_LATCH, mem8[DISPLAY_OFF_VALUE], LATCH_WRITE_OFFSET);
  const colourCell = TAMPER_WITNESS_SAMPLE_CELL & ~CHARACTER_PLANE_BIT;
  mem8[TAMPER_WITNESS] = mem8[TAMPER_WITNESS_SAMPLE_CELL];
  const colour = mem8[colourCell];
  mem8[TAMPER_WITNESS + 1] = colour;
  return (m.regs.a = colour, m.regs.b = 0, m.regs.d = (TAMPER_WITNESS + 1) >> 8, m.regs.e = (TAMPER_WITNESS + 1) & 0xff, m.regs.h = colourCell >> 8, m.regs.l = colourCell & 0xff, m.regs.f = compareFlags(total));
}
