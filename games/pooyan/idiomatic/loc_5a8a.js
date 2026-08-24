// SPDX-License-Identifier: GPL-3.0-only
import { loc_5a8c } from "./loc_5a8c.js";
/**
 * loc_5a8a — full-wrap entry into the shared score-accumulate tail.
 *
 * Seeds the accumulate amount to the wrap constant and falls straight into the accumulate tail,
 * which adds it to the running score byte and clamps.
 *
 * LIVE-OUT: memory only — via the accumulate tail.
 */
const WRAP_AMOUNT = 0x63; // amount seeded on a full-ring wrap

export function loc_5a8a(m) {
  return loc_5a8c(m, WRAP_AMOUNT);
}
