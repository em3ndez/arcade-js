// SPDX-License-Identifier: GPL-3.0-only
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";

/**
 * plotNormalizedCharCode — map a character/nibble code to its font-tile code and plot it.
 *
 * Carry clear: fold bit-5 on (a plain char). Carry set: keep the low nibble (a hex digit)
 * and fold bit-5 on unless it is zero. Then wrap codes >= 0x2a back down by 0x29. The
 * normalized byte is drawn and the draw cursor advanced by the plot helper.
 */
export function plotNormalizedCharCode(m, a = m.regs.a, carrySet = m.regs.fC) {
  let v = a & 0xff;
  // Exit carry is php-saved before the store and restored by the matching plp (the store's own carry is
  // discarded): set only when the entry carry held AND the low nibble was zero -- the sole path reaching
  // the php without an intervening clc.
  const exitCarry = carrySet && (v & 0x0f) === 0;
  if (carrySet) {
    v &= 0x0f;
    if (v !== 0) v = (v | 0x20) & 0xff;
  } else {
    v = (v | 0x20) & 0xff;
  }
  if (v >= 0x2a) v = (v - 0x29) & 0xff;
  writeMaskedByteAndAdvancePointer(m, v);
  return (m.regs.fC = exitCarry); // expose the true exit carry (register-out), not the store's carry
}
