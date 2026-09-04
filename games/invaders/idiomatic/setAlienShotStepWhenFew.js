// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_COUNT, loc_207e } from "./names.js";

// Seat the sentinel byte only while the counter is still below its threshold.
export function setAlienShotStepWhenFew(m) {
  if (m.mem8[ALIEN_COUNT] < 0x09) m.mem8[loc_207e] = 0xfb;
}
