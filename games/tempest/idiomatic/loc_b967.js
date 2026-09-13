// SPDX-License-Identifier: GPL-3.0-only
import { POINTER_PARITY, ALT_DRAW_PTR_CLR_LO, ALT_DRAW_PTR_CLR_HI, ALT_DRAW_PTR_SET_LO, ALT_DRAW_PTR_SET_HI } from "./names.js";

// Select an (A, X) pair from one of two parameter slots by a RAM flag: zero picks the first pair,
// non-zero the second. Returns [A, X] and writes them to the register file.
export function loc_b967(m) {
  const { mem8 } = m;
  let a, x;
  if (mem8[POINTER_PARITY] === 0) {
    a = mem8[ALT_DRAW_PTR_CLR_HI];
    x = mem8[ALT_DRAW_PTR_CLR_LO];
  } else {
    a = mem8[ALT_DRAW_PTR_SET_HI];
    x = mem8[ALT_DRAW_PTR_SET_LO];
  }
  return [(m.regs.a = a), (m.regs.x = x)];
}
