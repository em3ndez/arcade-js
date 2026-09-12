// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_a, loc_100, loc_16a, loc_1c9, loc_606, loc_706, loc_71b, loc_71c, loc_71d, loc_71e, loc_71f, loc_ac08 } from "./names.js";
import { loc_ac20 } from "./loc_ac20.js";
import { loc_ac36 } from "./loc_ac36.js";

// Refresh the edge state, arm the request byte, and when all three sources are idle
// request both rebuild flags; then per request bit copy a template block or fill a
// run of ones, optionally latch the control snapshot, and clear the two request bits.
export function loc_abac(m) {
  const { mem8 } = m;
  loc_ac20(m);
  mem8[loc_100] = 0x08;
  if ((mem8[loc_71b] | mem8[loc_71c] | mem8[loc_71d]) === 0) loc_ac36(m);

  const flags = mem8[loc_1c9];
  const copyTop = flags & 0x01 ? 0x17 : 0x0e;
  for (let x = copyTop; x >= 0; x--) mem8[u16(loc_606 + x)] = mem8[u16(loc_ac08 + x)];
  const fillTop = flags & 0x02 ? 0x17 : 0x0e;
  for (let x = fillTop; x >= 0; x--) mem8[u16(loc_706 + x)] = 0x01;
  if (flags & 0x03) {
    mem8[loc_71e] = mem8[loc_a] & 0xf8;
    mem8[loc_71f] = mem8[loc_16a] & 0x03;
  }
  mem8[loc_1c9] = flags & 0xfc;
}
