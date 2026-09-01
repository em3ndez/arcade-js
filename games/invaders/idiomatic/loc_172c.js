// SPDX-License-Identifier: GPL-3.0-only
import { loc_2025 } from "./names.js";
import { startSound } from "./startSound.js";
import { loc_19dc } from "./loc_19dc.js";

// With players selected raise the sound bit; otherwise mask the shot bit off.
export function loc_172c(m) {
  if (m.mem8[loc_2025] !== 0) return startSound(m, 0x02);
  return loc_19dc(m, 0xfd);
}
