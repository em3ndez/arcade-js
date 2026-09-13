// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_11f, POKEY1_RANDOM, POKEY2_RANDOM } from "./names.js";
import { loc_a8b4 } from "./loc_a8b4.js";
import { loc_af26 } from "./loc_af26.js";
import { loc_ae4e } from "./loc_ae4e.js";

// Fold two random samples into a scratch byte and a stored nibble, then draw and build.
export function loc_ae1c(m) {
  const { mem8 } = m;
  loc_a8b4(m);
  const r0 = mem8[POKEY1_RANDOM];
  mem8[loc_29] = mem8[POKEY1_RANDOM];
  mem8[loc_29] = (r0 >> 4) ^ mem8[loc_29];
  const r1 = mem8[POKEY2_RANDOM];
  const r1shift = mem8[POKEY2_RANDOM];
  mem8[loc_29] = ((r1 ^ mem8[loc_29]) & 0xf0) ^ mem8[loc_29];
  mem8[loc_11f] = ((r1shift << 4) & 0xff) ^ mem8[loc_29];
  loc_af26(m);
  return loc_ae4e(m, 0xff);
}
