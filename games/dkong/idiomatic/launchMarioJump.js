// SPDX-License-Identifier: GPL-3.0-only
/**
 * launchMarioJump — commit Mario's ballistic jump: write the airborne motion
 * record, set the jump pose, snapshot the take-off height, fire the jump sound.
 *
 * By the time control arrives, jump-init has already flagged Mario airborne and chosen
 * a horizontal launch velocity from the held direction — +128 (Right), −128 (Left) or
 * 0 (straight up), in 1/256-pixel units per frame — and hands it over as (vxHi, vxLo).
 * This routine writes the whole airborne state the ballistic integrator then reads
 * every frame:
 *
 *   - horizontal velocity MARIO_AIR_VX_HI:LO = the passed (vxHi, vxLo);
 *   - vertical velocity   MARIO_AIR_VY_HI:LO = 328, the fixed upward jump impulse
 *     (gravity is later derived from it and the airborne-frame count);
 *   - MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC all cleared to 0 — the arc starts
 *     at frame 0 with no accumulated sub-pixel remainder;
 *   - the pose MARIO_SPRITE_CODE keeps its facing bit (bit 7) and takes the jump
 *     state code 0x0E in the low bits;
 *   - MARIO_AIR_START_Y snapshots the current MARIO_Y — the take-off height the
 *     later fall-fatality test measures the landing against;
 *   - the jump sound fires via SND_TRIGGER bit 1, a 3-frame assert.
 *
 * Runs once per jump. Writes eight RAM bytes, reads two (the sprite code and Y), calls
 * nothing. The upward impulse is written unconditionally — this is the jump commit and
 * nothing else, not a shared fall-init path.
 *
 * LIVE-OUT: memory-only.
 */
import {
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_SPRITE_CODE, MARIO_Y,
  MARIO_AIR_START_Y, SND_TRIGGER,
} from "./names.js";

/** Low-bits sprite state code for the jump pose (the facing bit is preserved). */
const SPRITE_STATE_JUMP = 0x0e;

/**
 * @param {object} m     the machine.
 * @param {number} vxHi  high byte of the launch horizontal velocity.
 * @param {number} vxLo  low  byte of the launch horizontal velocity.
 */
export function launchMarioJump(m, vxHi, vxLo) {
  const { mem } = m;

  // Airborne velocity: horizontal from jump-init's choice, vertical the fixed
  // upward jump impulse 328 (high byte first, in MARIO_AIR_VY_HI).
  mem.write8(MARIO_AIR_VX_HI, vxHi);
  mem.write8(MARIO_AIR_VX_LO, vxLo);
  mem.write8(MARIO_AIR_VY_HI, 0x01);
  mem.write8(MARIO_AIR_VY_LO, 0x48);

  // Fresh arc: frame 0, no sub-pixel remainder in X or Y.
  mem.write8(MARIO_AIR_FRAMES, 0x00);
  mem.write8(MARIO_X_FRAC, 0x00);
  mem.write8(MARIO_Y_FRAC, 0x00);

  // Jump pose: keep the facing bit (bit 7), set the jump state code in the low bits.
  const facing = mem.read8(MARIO_SPRITE_CODE) & 0x80;
  mem.write8(MARIO_SPRITE_CODE, facing | SPRITE_STATE_JUMP);

  // Take-off height, for the later fall-fatality test.
  mem.write8(MARIO_AIR_START_Y, mem.read8(MARIO_Y));

  // Jump sound: SND_TRIGGER bit 1, a 3-frame assert.
  mem.write8(SND_TRIGGER + 1, 0x03);
}
