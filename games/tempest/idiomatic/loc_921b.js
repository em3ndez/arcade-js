// SPDX-License-Identifier: GPL-3.0-only
import { RIM_ROT_OFFSET, SPIKE_ACTIVE_FLAG, PLAYER_SEGMENT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH } from "./names.js";

// Init helper: seed five state cells with fixed constants. Takes no inputs.
export function loc_921b(m) {
  const { mem8 } = m;
  mem8[PLAYER_SEGMENT] = 0x0e;
  mem8[RIM_ROT_OFFSET] = 0xf0;
  mem8[SPIKE_ACTIVE_FLAG] = 0x00;
  mem8[PLAYER_FINE_ANGLE] = 0x0f;
  mem8[PLAYER_SHOT_DEPTH] = 0x10;
  return;
}
