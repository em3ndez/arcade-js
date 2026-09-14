// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER_SEGMENT, PLAYER_SHOT_DEPTH, ENEMY_SEGMENT, ENEMY_DEPTH } from "./names.js";
import { loc_a343 } from "./loc_a343.js";

// Collision test: fire the hit routine only when a slot's coordinates match the
// player's on both axes; any mismatch returns without effect.
export function fireHitOnPlayerCollision(m, x = m.regs.x, seedY = m.regs.y) {
  const { mem8 } = m;
  if (mem8[u16(ENEMY_DEPTH + x)] !== mem8[PLAYER_SHOT_DEPTH]) return;  // axis-one mismatch
  if (mem8[u16(ENEMY_SEGMENT + x)] !== mem8[PLAYER_SEGMENT]) return;  // axis-two mismatch
  loc_a343(m, x, seedY); // seedY (the dispatch index) is the seed's Y, threaded explicitly
}
