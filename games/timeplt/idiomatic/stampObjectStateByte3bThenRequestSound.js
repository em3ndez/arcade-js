// SPDX-License-Identifier: GPL-3.0-only
/** stampObjectStateByte3bThenRequestSound — stamp one object's state byte to fifty-nine and ask for the sound that goes with
 * it. The stamp is unconditional: nothing here reads the byte first, and nothing chooses between
 * two outcomes. LIVE-OUT: memory. */

import { requestObjectState3bSound } from "./requestObjectState3bSound.js";

const STATE = 0;
const STAMPED_STATE = 59;

export function stampObjectStateByte3bThenRequestSound(m, object = m.regs.ix) {
  m.mem8[object + STATE] = STAMPED_STATE;
  requestObjectState3bSound(m);
}
