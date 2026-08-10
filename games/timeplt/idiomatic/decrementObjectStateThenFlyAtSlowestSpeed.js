// SPDX-License-Identifier: GPL-3.0-only
/** decrementObjectStateThenFlyAtSlowestSpeed — count an object's state byte down one and let it fly on at the slowest of the
 * velocity-table speeds. The countdown wraps at a byte and nothing here tests it, so reaching
 * zero is somebody else's business; the step happens either way. LIVE-OUT: memory-only. */

import { flyAtSlowestSpeed } from "./flyAtSlowestSpeed.js";
import { u8 } from "../../../core/int.js";

const STATE = 0;

export function decrementObjectStateThenFlyAtSlowestSpeed(m, object = m.regs.ix) {
  const { mem8 } = m;
  mem8[object + STATE] = u8(mem8[object + STATE] - 1);
  flyAtSlowestSpeed(m);
}
