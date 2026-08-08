// SPDX-License-Identifier: GPL-3.0-only
/** loc_2c22 — move one object for the frame according to its state byte, then run the shared
 * appearance step over that same object. From thirty-two up the object counts its state byte down
 * and flies on at the slowest table speed; below thirty-two it only drifts with the world and the
 * state byte is left alone. The appearance step runs on both paths.
 * LIVE-OUT: memory. */

import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { loc_2bb4 } from "./loc_2bb4.js";
import { loc_2c31 } from "./loc_2c31.js";

const STATE = 0;
const COUNTDOWN_FROM = 32;

export function loc_2c22(m, object = m.regs.ix) {
  if (m.mem8[object + STATE] >= COUNTDOWN_FROM) loc_2bb4(m, object);
  else driftWithWorldScroll(m);

  loc_2c31(m, object);
}
