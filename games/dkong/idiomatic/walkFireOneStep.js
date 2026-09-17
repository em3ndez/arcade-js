// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkFireOneStep — step one fire a single position along its heading: move its working X one
 * pixel, mirror its sprite to match, advance its animation, then re-snap its working Y to the
 * girder underneath (girder board only; off that board the slope tail does nothing).
 *
 * STATE_STEP_UP steps X up and sets the sprite flip bit; every other state steps X down and
 * clears it. The animation clock then runs over the same sprite code byte, so order matters:
 * the flip bit is written first and the animation step lands on top of it.
 *
 * LIVE-OUT: memory only — the fire's working X, its sprite tile code, the animation down-counter
 * and, on the girder board, the working Y.
 */

import { OBJ_STATE, OBJ_SPRITE_CODE } from "./names.js";
import { stepObjectSpriteFrame } from "./stepObjectSpriteFrame.js";
import { settleFireOnGirderSlope } from "./settleFireOnGirderSlope.js";

// Fire-record working X (one stage upstream of the drawn OBJ_X); the OBJ_SPRITE_CODE here is the
// object record's own field, NOT the like-named field of a hardware sprite record.
const OBJ_WORKING_X = 0x0e;
const SPRITE_FLIP = 0x80;
const STATE_STEP_UP = 1;

export function walkFireOneStep(m) {
  const { regs, mem8 } = m;

  const objBase = regs.ix;
  const codeAddr = (objBase + OBJ_SPRITE_CODE) & 0xffff;
  const xAddr = (objBase + OBJ_WORKING_X) & 0xffff;

  // One direction bit, two effects: which way X moves, and which way the sprite faces.
  const code = mem8[codeAddr];
  if (mem8[(objBase + OBJ_STATE) & 0xffff] === STATE_STEP_UP) {
    mem8[codeAddr] = code | SPRITE_FLIP;
    mem8[xAddr] = mem8[xAddr] + 1;
  } else {
    mem8[codeAddr] = code & ~SPRITE_FLIP;
    mem8[xAddr] = mem8[xAddr] - 1;
  }

  stepObjectSpriteFrame(m, objBase);

  settleFireOnGirderSlope(m);
}
