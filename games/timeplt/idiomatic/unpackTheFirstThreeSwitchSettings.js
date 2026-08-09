// SPDX-License-Identifier: GPL-3.0-only
/** unpackTheFirstThreeSwitchSettings — open the first three settings cells: the first takes the whole
 * byte the caller arrived with, the next two each one bit of a packed byte in ascending order. The
 * packed byte is handed on rotated until the last bit spent sits lowest, twice over in both carrying
 * registers; control tail-transfers into the continuation and never comes back. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { loc_49a8 } from "./loc_49a8.js";

const WHOLE_BYTE_CELL = 0xa9c1;
const SINGLE_BIT_CELLS = [
  { cell: 0xa9c2, bit: 2 },
  { cell: 0xa9c3, bit: 3 },
];
const LAST_BIT_SPENT = SINGLE_BIT_CELLS[SINGLE_BIT_CELLS.length - 1].bit;
const BITS_IN_A_BYTE = 8;

export function unpackTheFirstThreeSwitchSettings(m, whole = m.regs.a, packed = m.regs.c) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = whole;
  for (const { cell, bit } of SINGLE_BIT_CELLS) mem8[cell] = (packed >> bit) & 1;
  const unspent = u8((packed >> LAST_BIT_SPENT) | (packed << (BITS_IN_A_BYTE - LAST_BIT_SPENT)));
  regs.a = unspent;
  regs.c = unspent;
  return loc_49a8(m);
}
