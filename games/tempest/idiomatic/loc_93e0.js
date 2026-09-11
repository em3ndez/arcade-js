// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_29 } from "./names.js";

// Fold A's top three bits (MSB first) into the low bits of a 0xff seed, stash it,
// then derive X from its complement. A ends up holding the input shifted left 3x
// (the pha/pla preserves the SHIFTED A, not the input); Y ends up holding the seed.
export function loc_93e0(m, a = m.regs.a) {
  const { mem8 } = m;
  let acc = 0xff;
  for (let i = 0; i < 3; i++) {
    const bit = (a >> 7) & 1;
    a = u8(a << 1);
    acc = u8((acc << 1) | bit);
  }
  mem8[loc_29] = acc;
  // Three register live-outs (A shifted, X derived, Y=seed) — all ride the return so callers see them.
  return [(m.regs.a = a), (m.regs.x = ((acc ^ 0xff) + 0x0d) >> 1), (m.regs.y = acc)];
}
