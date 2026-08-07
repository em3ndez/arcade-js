// SPDX-License-Identifier: GPL-3.0-only
/** loc_46ce — file two register pairs away in an object's record, as four separate bytes: the first
 * pair into two adjacent slots, the second into two more sixteen slots further on. Each half goes
 * in high byte first, so the pair is stored the opposite way round from a word. Nothing is read,
 * nothing is tested, and the four values are taken exactly as they arrive.
 * LIVE-OUT: memory, four bytes. */

import { u16 } from "../../../core/int.js";

const FIRST_PAIR_SLOT = 12;
const SECOND_PAIR_SLOT = 28;

export function loc_46ce(
  m,
  record = m.regs.ix,
  firstHigh = m.regs.d,
  firstLow = m.regs.e,
  secondHigh = m.regs.b,
  secondLow = m.regs.c,
) {
  const { mem8 } = m;
  mem8[u16(record + FIRST_PAIR_SLOT)] = firstHigh;
  mem8[u16(record + FIRST_PAIR_SLOT + 1)] = firstLow;
  mem8[u16(record + SECOND_PAIR_SLOT)] = secondHigh;
  mem8[u16(record + SECOND_PAIR_SLOT + 1)] = secondLow;
}
