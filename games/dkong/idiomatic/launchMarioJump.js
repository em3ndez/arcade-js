// SPDX-License-Identifier: GPL-3.0-only
/**
 * launchMarioJump — commit Mario's ballistic jump: write the airborne motion record, set the
 * jump pose, snapshot the take-off height, and fire the jump sound. The horizontal launch
 * velocity is passed in as (vxHi, vxLo); the upward impulse is the fixed 328.
 *
 * LIVE-OUT: memory-only.
 */
import {
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_SPRITE_CODE, MARIO_Y,
  MARIO_AIR_START_Y, SND_TRIGGER,
} from "./names.js";

// Low-bits jump-pose sprite state; the facing bit (bit 7) is preserved separately.
const SPRITE_STATE_JUMP = 0x0e;

export function launchMarioJump(m, vxHi, vxLo) {
  const { mem8 } = m;

  // Vertical impulse 328, split high byte (0x01) then low (0x48).
  mem8[MARIO_AIR_VX_HI] = vxHi;
  mem8[MARIO_AIR_VX_LO] = vxLo;
  mem8[MARIO_AIR_VY_HI] = 0x01;
  mem8[MARIO_AIR_VY_LO] = 0x48;

  mem8[MARIO_AIR_FRAMES] = 0x00;
  mem8[MARIO_X_FRAC] = 0x00;
  mem8[MARIO_Y_FRAC] = 0x00;

  const facing = mem8[MARIO_SPRITE_CODE] & 0x80;
  mem8[MARIO_SPRITE_CODE] = facing | SPRITE_STATE_JUMP;

  mem8[MARIO_AIR_START_Y] = mem8[MARIO_Y];

  mem8[SND_TRIGGER + 1] = 0x03;
}
