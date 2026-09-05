// SPDX-License-Identifier: GPL-3.0-only
// Service the shot block, then read its {counter, field} back as a coordinate word and write the shot's
// two render cells, complementing the field; the direction flag picks between two low-byte X formulas.
import { loc_4018, loc_4209, loc_420a, loc_409d, loc_409f } from "./names.js";
import { advancePlayerShot } from "./advancePlayerShot.js";

export function loc_0898(m) {
  const { mem8 } = m;

  advancePlayerShot(m);
  const lo = mem8[loc_4209];
  const hi = mem8[loc_420a];

  // direction bit set -> X = counter - 1; clear -> X = complement(counter) + 252
  mem8[loc_409f] = mem8[loc_4018] & 0x01 ? lo - 1 : ~lo + 252;
  mem8[loc_409d] = ~hi;
}
