// SPDX-License-Identifier: GPL-3.0-only
import { loc_1c9 } from "./names.js";
import { loc_ac20 } from "./loc_ac20.js";
import { loc_ac07 } from "./loc_ac07.js";
import { loc_abac } from "./loc_abac.js";

// Refresh the control state, then branch on the low two request bits: idle takes the
// no-op tail, otherwise run the rebuild/copy path.
export function loc_aba2(m) {
  const { mem8 } = m;
  loc_ac20(m);
  if ((mem8[loc_1c9] & 0x03) === 0) return loc_ac07();
  return loc_abac(m);
}
