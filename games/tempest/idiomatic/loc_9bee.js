// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_10b, loc_10c } from "./names.js";

// One demo-sequencer tick: while the hold gate is zero, advance the step counter by two.
export function loc_9bee(m) {
  const { mem8 } = m;
  if (mem8[loc_10c] !== 0) return;
  mem8[loc_10b] = u8(mem8[loc_10b] + 2);
}
