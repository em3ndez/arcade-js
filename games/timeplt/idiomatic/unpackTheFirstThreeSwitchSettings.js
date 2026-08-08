// SPDX-License-Identifier: GPL-3.0-only
/** unpackTheFirstThreeSwitchSettings — open the first three settings cells. The name's "switch" is
 * established by the CALLER, which reads the cabinet switch bank, and by the readers downstream;
 * this routine itself reads no memory and cannot see where its byte came from. The first cell takes,
 * whole, the byte the caller arrived with. The two after it take one bit each out of a packed byte,
 * in ascending bit order, one cell per bit and nothing else in the cell. The packed byte is then
 * handed on rotated until the last bit spent sits lowest, which is where the continuation this
 * entry transfers into carries the peeling on; it is handed on twice over, in both of the
 * registers that carry it. Nothing is read from memory and control never comes back.
 * LIVE-OUT: the three cells, the rotated byte twice over, and whatever the continuation leaves. */

import { u8 } from "../../../core/int.js";

const WHOLE_BYTE_CELL = 0xa9c1;
const SINGLE_BIT_CELLS = [
  { cell: 0xa9c2, bit: 2 },
  { cell: 0xa9c3, bit: 3 },
];
const LAST_BIT_SPENT = SINGLE_BIT_CELLS[SINGLE_BIT_CELLS.length - 1].bit;
const BITS_IN_A_BYTE = 8;
const CONTINUATION = 0x49a8;

export function unpackTheFirstThreeSwitchSettings(m, whole = m.regs.a, packed = m.regs.c) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = whole;
  for (const { cell, bit } of SINGLE_BIT_CELLS) mem8[cell] = (packed >> bit) & 1;
  const unspent = u8((packed >> LAST_BIT_SPENT) | (packed << (BITS_IN_A_BYTE - LAST_BIT_SPENT)));
  regs.a = unspent;
  regs.c = unspent;
  return m.call(CONTINUATION);
}
