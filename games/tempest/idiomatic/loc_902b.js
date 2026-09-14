// SPDX-License-Identifier: GPL-3.0-only
import { SPIKED_SEGMENT_COUNT, RIM_COLOR_ANIM, ENEMY_ANIM_ACCUM } from "./names.js";
import { clearActiveShots } from "./clearActiveShots.js";
import { clearShotTableAndStateFlags } from "./clearShotTableAndStateFlags.js";
import { seedSlotRandomTags } from "./seedSlotRandomTags.js";
import { clearEightByteTableAndFlag } from "./clearEightByteTableAndFlag.js";
import { clearByte50 } from "./clearByte50.js";
import { buildLevelLayout } from "./buildLevelLayout.js";

// Run the six subsystem resets, then seed two bytes high and one byte clear.
export function loc_902b(m) {
  const { mem8 } = m;
  clearActiveShots(m);
  clearShotTableAndStateFlags(m);
  seedSlotRandomTags(m);
  clearEightByteTableAndFlag(m);
  clearByte50(m);
  buildLevelLayout(m);
  mem8[RIM_COLOR_ANIM] = 0xff;
  mem8[ENEMY_ANIM_ACCUM] = 0xff;
  mem8[SPIKED_SEGMENT_COUNT] = 0x00;
}
