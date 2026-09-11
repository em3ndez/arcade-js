// SPDX-License-Identifier: GPL-3.0-only
import { loc_22, loc_23, loc_24, loc_809, loc_80a, loc_80b } from "./names.js";

// Seed the paired 3-entry arrays with the fixed values 0, 4, 12.
export function loc_b85f(m) {
  const { mem8 } = m;
  mem8[loc_80b] = 0x0c;
  mem8[loc_24] = 0x0c;
  mem8[loc_80a] = 0x04;
  mem8[loc_23] = 0x04;
  mem8[loc_22] = 0x00;
  mem8[loc_809] = 0x00;
}
