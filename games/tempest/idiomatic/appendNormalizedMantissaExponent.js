// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  OBJ_DEPTH, DEPTH_LO, DEPTH_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI, SEG_SPREAD_A_LO, SEG_SPREAD_A_LO_1, SEG_SPREAD_A_LO_2, loc_a0, DRAW_CURSOR_OFFSET,
  MATHBOX_STATUS, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI, MATHBOX_LD_R6_COUNT, MATHBOX_LD_RA_HI, MATHBOX_DIVIDE, MATHBOX_LD_R7_LO, MATHBOX_LD_R7_HI,
} from "./names.js";

// Append a (mantissa, exponent) pair to the table: small inputs use a fixed pair,
// otherwise drive the math coprocessor and normalize its result into an exponent.
// Returns exit Y (= ($a9 + 2) & 0xff) -- the shared convergence at bd90..bd9f loads Y
// from $a9 (bd96) and does two iny (bd99, bd9f), so both RTS paths leave Y = $a9 + 2.
// Callers (b69b sty $a9; bd09/c6c7 iny (($74),y)) consume this Y. Exit X is NOT returned:
// the trivial ($57<0x10) path never sets X, so its exit X is the incoming register (cruft,
// not expressible), and every caller overwrites X before use -- see selfAssessment/notes.
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
