// SPDX-License-Identifier: GPL-3.0-only
// Memory fill: store `value` into `count` bytes from `dest`, walking the pointer forward. A count of 0
// wraps to a full 256-byte fill. Hands back the pointer past the fill and the spent count (0).
import { u16 } from "../../../core/int.js";

export function loc_0010(m, dest = m.regs.hl, value = m.regs.a, count = m.regs.b) {
  const { mem8 } = m;

  let ptr = dest;
  let remaining = count;
  do {
    mem8[ptr] = value;
    ptr = u16(ptr + 1);
    remaining = (remaining - 1) & 0xff; // wraps 0 -> 255, so count 0 fills 256 bytes
  } while (remaining !== 0);

  return (m.regs.hl = ptr, m.regs.b = 0);
}
