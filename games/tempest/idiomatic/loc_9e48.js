// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_200, loc_202, loc_2b9, loc_2df } from "./names.js";
import { loc_a343 } from "./loc_a343.js";

// Collision test: fire the hit routine only when a slot's coordinates match the
// player's on both axes; any mismatch returns without effect.
export function loc_9e48(m, x = m.regs.x) {
  const { mem8 } = m;
  if (mem8[u16(loc_2df + x)] !== mem8[loc_202]) return;  // axis-one mismatch
  if (mem8[u16(loc_2b9 + x)] !== mem8[loc_200]) return;  // axis-two mismatch
  loc_a343(m, x);
}
