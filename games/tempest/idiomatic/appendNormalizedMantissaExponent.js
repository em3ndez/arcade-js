// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  OBJ_DEPTH, DEPTH_LO, DEPTH_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI, SEG_SPREAD_A_LO, SEG_SPREAD_A_LO_1, SEG_SPREAD_A_LO_2, loc_a0, DRAW_CURSOR_OFFSET,
  MATHBOX_STATUS, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI, MATHBOX_LD_R6_COUNT, MATHBOX_LD_RA_HI, MATHBOX_DIVIDE, MATHBOX_LD_R7_LO, MATHBOX_LD_R7_HI,
} from "./names.js";

/**
 * appendNormalizedMantissaExponent — append a (mantissa, exponent) pair to the draw list. ROM 0xbd3e.
 *
 * Role in the machine: Tempest draws the tube in perspective, so an object's on-screen size falls off
 * with its depth down the well ($57 = OBJ_DEPTH). This routine turns that depth into a compact
 * floating-point size record — a mantissa (shift count) plus an exponent — and appends the two bytes to
 * the display list the vector generator will consume. Near objects (depth < 0x10) are drawn at full size
 * with a fixed (1, 0) pair; farther objects need a reciprocal-style scale, which the board's math box (a
 * hardware divide/normalize coprocessor) computes.
 *
 * Behavior: if $57 < 0x10, take the trivial pair a=1, y=0. Otherwise form the 16-bit difference
 * $57:0 minus $5f:$5b (DEPTH_HI:DEPTH_LO), load it plus $a0 and a 0x18 iteration count into the math-box
 * operand registers, issue the divide, and spin on the MATHBOX_STATUS busy bit (0x80) until done. Copy the
 * 16-bit result into the segment-spread scratch pair ($79 lo, $78 hi = SEG_SPREAD_A_LO_1/_2), then
 * software-normalize: decrement the hi byte (clamped to at least 1), and shift the scratch:accumulator pair
 * left, counting iterations in x, until a 1 rolls out of the accumulator's top. The final exponent y is a
 * two's-complement fold of (a>>1), and the mantissa a becomes x, the shift count.
 *
 * Both paths converge at the append: store the mantissa into SEG_SPREAD_A_LO, load the cursor offset $a9
 * (DRAW_CURSOR_OFFSET), and write the exponent then the mantissa (tagged 0x70) at the draw cursor
 * ($74/$75), bumping the offset with each write (the two iny at 0xbd99/0xbd9f).
 *
 * Live-out: the two appended bytes at the draw cursor; SEG_SPREAD_A_LO / _LO_1 / _LO_2 scratch. Returns
 * exit Y (= ($a9 + 2) & 0xff) -- the shared convergence at bd90..bd9f loads Y from $a9 (bd96) and does two
 * iny (bd99, bd9f), so both RTS paths leave Y = $a9 + 2. Callers (b69b sty $a9; bd09/c6c7 iny (($74),y))
 * consume this Y. Exit X is NOT returned: the trivial ($57<0x10) path never sets X, so its exit X is the
 * incoming register (cruft, not expressible), and every caller overwrites X before use -- see
 * selfAssessment/notes. Grounding: [seen].
 */
export function appendNormalizedMantissaExponent(m) {
  const { mem8 } = m;
  let a, y;
  if (mem8[OBJ_DEPTH] < 0x10) {
    a = 0x01;
    y = 0x00;
  } else {
    // 16-bit difference into the coprocessor operand registers.
    let t = mem8[OBJ_DEPTH] - mem8[DEPTH_HI];
    const borrow = t < 0 ? 1 : 0;
    mem8[MATHBOX_LD_R7_LO] = t;
    mem8[MATHBOX_LD_R7_HI] = (0 - mem8[DEPTH_LO] - borrow);
    mem8[MATHBOX_LD_R6_COUNT] = 0x18;
    mem8[MATHBOX_LD_RA_HI] = mem8[loc_a0];
    mem8[MATHBOX_DIVIDE] = mem8[loc_a0];         // issue the compute
    while ((mem8[MATHBOX_STATUS] & 0x80) !== 0) {}      // wait for done
    mem8[SEG_SPREAD_A_LO_1] = mem8[MATHBOX_RESULT_LO];
    a = mem8[SEG_SPREAD_A_LO_2] = mem8[MATHBOX_RESULT_HI];
    mem8[MATHBOX_LD_R6_COUNT] = 0x0f;
    a = (a - 1) & 0xff;
    if (a === 0) a = 0x01;
    let x = 0;
    for (;;) {
      x = (x + 1) & 0xff;
      const shiftOut = (mem8[SEG_SPREAD_A_LO_1] >> 7) & 1;
      mem8[SEG_SPREAD_A_LO_1] = (mem8[SEG_SPREAD_A_LO_1] << 1);
      const top = (a >> 7) & 1;
      a = ((a << 1) | shiftOut) & 0xff;
      if (top !== 0) break;                       // stop once a 1 rolls out
    }
    y = ((((a >> 1) ^ 0x7f) + 1) & 0xff);         // exponent
    a = x;                                        // mantissa shift count
  }
  mem8[SEG_SPREAD_A_LO] = a;
  const saved = a & 0xff;
  a = y;
  y = mem8[DRAW_CURSOR_OFFSET];
  const ptr = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);
  mem8[u16(ptr + y)] = a;
  y = (y + 1) & 0xff;                 // bd99 iny
  mem8[u16(ptr + y)] = (saved | 0x70);
  y = (y + 1) & 0xff;                 // bd9f iny -- second post-write iny; exit Y = $a9 + 2
  return y;
}
