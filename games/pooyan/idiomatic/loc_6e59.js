// SPDX-License-Identifier: GPL-3.0-only
import { loc_6e75 } from "./loc_6e75.js";
import { loc_1e55 } from "./loc_1e55.js";
import { loc_20d4 } from "./loc_20d4.js";
import { loc_02ef } from "./loc_02ef.js";
import { loc_18da } from "./loc_18da.js";
import { loc_191c } from "./loc_191c.js";
import { loc_6404 } from "./loc_6404.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";
import { loc_1583 } from "./loc_1583.js";

/**
 * loc_6e59 — level-intro phase-1 per-frame body: nine sub-passes in fixed order. The first is the
 * frame-tick + rst-0x28 gameplay dispatch; the rest are
 * the phase-1 spawner, joystick sampler, object-update gate, sprite rebuild, bonus tally, speed pick,
 * collision driver, and one sound-ring drain.
 *
 * LIVE-OUT: none — a void driver.
 */
export function loc_6e59(m) {
  loc_1583(m);
  loc_6e75(m);
  loc_1e55(m);
  loc_20d4(m);
  loc_02ef(m);
  loc_18da(m);
  loc_191c(m);
  loc_6404(m);
  drainSoundCommandRing(m);
}
