// SPDX-License-Identifier: GPL-3.0-only
/**
 * precheckCollisionBounds — bias an actor's X and test whether its Y+margin clears the bottom.
 *
 * Reads the flip-screen flag to pick the X bias (+6 upright, -2 flipped), forms
 * E = (rec+0x00) + bias, then A = (rec+0x02) + 8 and compares A to the bottom limit 0xe0.
 * A pure leaf: two record reads plus one flag read, writes nothing.
 *
 * LIVE-OUT: { e, a, carry }. carry (A < 0xe0) is the below-bottom result the caller branches
 * on; e is the biased X left in the E register (needs a bridge if the caller reads it); a is
 * the biased Y+margin left in A.
 */
import { FLIP_SCREEN_FLAG } from "./names.js";

const UPRIGHT_BIAS = 0x06;
const FLIPPED_BIAS = 0xfe; // -2 in two's complement
const Y_MARGIN = 0x08;
const BOTTOM_LIMIT = 0xe0;

export function precheckCollisionBounds(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? UPRIGHT_BIAS : FLIPPED_BIAS;
  const e = (mem8[rec + 0x00] + bias) & 0xff;
  const a = (mem8[rec + 0x02] + Y_MARGIN) & 0xff;
  const carry = a < BOTTOM_LIMIT;
  return { e, a, carry };
}
