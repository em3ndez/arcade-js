// SPDX-License-Identifier: GPL-3.0-only
import { MODE_DISPATCH_SEL, DEPTH_LO, DEPTH_HI, SPIKE_ACTIVE_FLAG } from "./names.js";
import { loc_92c5 } from "./loc_92c5.js";
import { loc_9234 } from "./loc_9234.js";
import { loc_902b } from "./loc_902b.js";
import { loc_a831 } from "./loc_a831.js";

// Init sequence: run the four setup subroutines in order, then seed DEPTH_LO and clear
// SPIKE_ACTIVE_FLAG/DEPTH_HI/MODE_DISPATCH_SEL.
export function loc_9009(m) {
  const { mem8 } = m;

  loc_92c5(m);
  loc_9234(m);
  loc_902b(m);
  loc_a831(m);

  mem8[DEPTH_LO] = 250;
  mem8[SPIKE_ACTIVE_FLAG] = 0;
  mem8[DEPTH_HI] = 0;
  mem8[MODE_DISPATCH_SEL] = 0;
}
