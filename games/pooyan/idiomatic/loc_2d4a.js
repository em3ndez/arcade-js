// SPDX-License-Identifier: GPL-3.0-only
import { WAVE_HOLD_TIMER } from "./names.js";
/**
 * loc_2d4a — hunter dispatch state 3 (dissolved caller-skip). Clears the wave-hold timer and returns
 * false — a caller-skip boolean that aborts the per-record hunter walk. LIVE-OUT: the boolean.
 */
export function loc_2d4a(m) {
  m.mem8[WAVE_HOLD_TIMER] = 0;
  return false; // caller-skip
}
