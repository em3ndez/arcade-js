// SPDX-License-Identifier: GPL-3.0-only
import { loc_2400, loc_4000 } from "./names.js";

// Zero the video-RAM span, from its base up to the top of RAM.
export function loc_1a5c(m) {
  for (let a = loc_2400; a < loc_4000; a++) m.mem8[a] = 0x00;
}
