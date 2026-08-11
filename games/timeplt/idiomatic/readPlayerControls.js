// SPDX-License-Identifier: GPL-3.0-only
/** readPlayerControls — hand back the control word of the cabinet panel that faces the picture.
 * Both panels are mirrored into work RAM every frame and a flag cell selects between them.
 * LIVE-OUT: that word, returned and left in the register file; nothing is written here. */

import { IN1_MIRROR, IN2_MIRROR, SCREEN_UNFLIPPED } from "./names.js";


export function readPlayerControls(m) {
  const { regs, mem8 } = m;
  const flipped = mem8[SCREEN_UNFLIPPED] === 0;
  const panel = flipped ? IN2_MIRROR : IN1_MIRROR;
  regs.a = mem8[panel];
  return regs.a;
}
