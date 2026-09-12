// SPDX-License-Identifier: GPL-3.0-only
import { loc_123, loc_124, loc_148 } from "./names.js";
import { loc_928f } from "./loc_928f.js";
import { loc_926f } from "./loc_926f.js";
import { loc_9246 } from "./loc_9246.js";
import { loc_929f } from "./loc_929f.js";
import { loc_92ad } from "./loc_92ad.js";
import { loc_c16e } from "./loc_c16e.js";

// Run the six subsystem resets, then seed two bytes high and one byte clear.
export function loc_902b(m) {
  const { mem8 } = m;
  loc_928f(m);
  loc_926f(m);
  loc_9246(m);
  loc_929f(m);
  loc_92ad(m);
  loc_c16e(m);
  mem8[loc_124] = 0xff;
  mem8[loc_148] = 0xff;
  mem8[loc_123] = 0x00;
}
