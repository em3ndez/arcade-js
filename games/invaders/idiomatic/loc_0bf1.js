// SPDX-License-Identifier: GPL-3.0-only
import { drawTaitoCopyright } from "./drawTaitoCopyright.js";
import { loc_190a } from "./loc_190a.js";

// Run the pre-round state-and-fleet update, then tail into drawTaitoCopyright -- a redraw trampoline.
export function loc_0bf1(m) {
  loc_190a(m);
  return drawTaitoCopyright(m);
}
