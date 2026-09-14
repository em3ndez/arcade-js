// SPDX-License-Identifier: GPL-3.0-only
import { loc_9e, PLAYER_SHOT_DEPTH, OBJ_DEPTH, loc_2f, PLAYER_FINE_ANGLE, PLAYER_SEGMENT, RIM_ROT_OFFSET } from "./names.js";
import { drawTubeRimSegmentFromCorner } from "./drawTubeRimSegmentFromCorner.js";

// Flag a rebuild, then when the gate byte is in range latch it into two slots and,
// unless the marker byte holds the skip value, kick a spread build whose size comes
// from a shifted parameter.
export function drawScoreStatusList(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x01;
  const gate = mem8[PLAYER_SHOT_DEPTH];
  if (gate === 0 || gate >= 0xf0) return;
  mem8[OBJ_DEPTH] = gate;
  mem8[loc_2f] = gate;
  if (mem8[PLAYER_FINE_ANGLE] === 0x81) return;
  const y = mem8[PLAYER_SEGMENT];
  const size = (((mem8[RIM_ROT_OFFSET] >> 1) & 0x07) + 1) & 0xff;
  drawTubeRimSegmentFromCorner(m, size, y);
}
