// SPDX-License-Identifier: GPL-3.0-only
import { loc_415, loc_ce86, loc_ce87, loc_ce6e, loc_ce6f } from "./names.js";

// Select an (A, X) pair from one of two parameter slots by a RAM flag: zero picks the first pair,
// non-zero the second. Returns [A, X] and writes them to the register file.
export function loc_b967(m) {
  const { mem8 } = m;
  let a, x;
  if (mem8[loc_415] === 0) {
    a = mem8[loc_ce87];
    x = mem8[loc_ce86];
  } else {
    a = mem8[loc_ce6f];
    x = mem8[loc_ce6e];
  }
  return [(m.regs.a = a), (m.regs.x = x)];
}
