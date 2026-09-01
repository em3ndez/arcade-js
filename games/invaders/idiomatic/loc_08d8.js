// SPDX-License-Identifier: GPL-3.0-only
import { loc_2082, loc_207e } from "./names.js";

// Seat the sentinel byte only while the counter is still below its threshold.
export function loc_08d8(m) {
  if (m.mem8[loc_2082] < 0x09) m.mem8[loc_207e] = 0xfb;
}
