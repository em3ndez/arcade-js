// SPDX-License-Identifier: GPL-3.0-only
/**
 * endClimbAtLadderLimit — finish a ladder climb that has reached a ladder end: set the
 * ladder-end pose, clear the climb toggle and the on-ladder flag, then refresh the sprite record.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_SPRITE_CODE, MARIO_ON_LADDER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

const CLIMB_TOGGLE = 0x6219;
const LADDER_END_POSE = 0x06; // written flat; the facing bit is dropped at a ladder end

export function endClimbAtLadderLimit(m) {
  const { mem8 } = m;
  mem8[MARIO_SPRITE_CODE] = LADDER_END_POSE;
  mem8[CLIMB_TOGGLE] = 0x00;
  mem8[MARIO_ON_LADDER] = 0x00;
  writeMarioSpriteRecord(m);
}
