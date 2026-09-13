// SPDX-License-Identifier: GPL-3.0-only
import { SWEEP_STAGE, WAVE_PHASE_LATCH } from "./names.js";

// Reset leaf: zero a pair of working cells at once.
export function loc_a831(m) {
  const { mem8 } = m;
  mem8[SWEEP_STAGE] = 0x00;
  mem8[WAVE_PHASE_LATCH] = 0x00;
}
