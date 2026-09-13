// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_STATE } from "./names.js";
import { loc_a463 } from "./loc_a463.js";

// Scan slots x = 7..0; each nonzero entry drives the per-slot mover with that entry as the
// threshold and x as the slot index.
export function loc_a454(m) {
  const { mem8 } = m;
  for (let x = 7; x >= 0; x--) {
    const entry = mem8[SLOT_STATE + x];
    if (entry !== 0) loc_a463(m, entry, x);
  }
}
