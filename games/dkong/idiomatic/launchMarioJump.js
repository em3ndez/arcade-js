// SPDX-License-Identifier: GPL-3.0-only
/**
 * launchMarioJump — commit Mario's ballistic jump: write the airborne motion
 * record, set the jump pose, snapshot the take-off height, fire the jump sound.
 * ROM 0x1B8A.
 *
 * The jump-init routine (loc_1b6e) has already flagged Mario airborne and chosen a
 * horizontal launch velocity from the held direction — +0x0080 (Right), 0xFF80
 * (Left) or 0x0000 (straight up) — and tail-jumps here with it in (vxHi, vxLo).
 * This routine writes the whole airborne state the ballistic integrator then reads
 * every frame:
 *
 *   - horizontal velocity MARIO_AIR_VX (0x6210:0x6211) = the passed (vxHi, vxLo);
 *   - vertical velocity   MARIO_AIR_VY (0x6212:0x6213) = 0x0148, the fixed upward
 *     jump impulse (gravity is later derived from it and the airborne-frame count);
 *   - MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC all cleared to 0 — the arc starts
 *     at frame 0 with no accumulated sub-pixel remainder;
 *   - the pose MARIO_SPRITE_CODE keeps its facing bit (bit 7) and takes the jump
 *     state code 0x0E in the low bits;
 *   - MARIO_AIR_START_Y snapshots the current MARIO_Y — the take-off height the
 *     later fall-fatality test measures the landing against;
 *   - the jump sound fires via SND_TRIGGER bit 1 (0x6081 = 3, a 3-frame assert).
 *
 * Reached once per jump, from loc_1b6e (itself dispatchMarioMovement's jump arm). Writes eight
 * RAM bytes, reads two (the sprite code and Y), calls nothing. (Aside: names.js notes
 * a fall "sets VY to 0" citing this address — that is a separate fall-init path; this
 * routine unconditionally writes the 0x0148 jump impulse, and its sole caller is the
 * jump arm.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-1b8a.test.js.
 * GATE:     crafted-entry sweep (all three velocity arms × facing-bit × take-off-Y
 *           edges, oracle vs candidate on fresh clones) + real captured attract
 *           dispatches (all three arms occur naturally). Teeth: a twin that drops the
 *           facing bit when re-posing the sprite.
 * LIVE-OUT: memory-only. dispatchMarioMovement→loc_1b6e→here is a tail-jump chain; the `ret`
 *           returns to loc_197a @0x1983, which immediately `call`s the next cascade
 *           routine (0x1f72) without reading A/HL/BC or flags. The oracle's residual
 *           A (=take-off Y), HL (=0x6081) and BC (=velocity) are dead ABI — every
 *           value that matters was written to RAM. (No pc/SP: the Z80 `ret` is the
 *           JS return.)
 * NAMES:    MARIO_AIR_VX_HI/LO, MARIO_AIR_VY_HI/LO, MARIO_AIR_FRAMES, MARIO_X_FRAC,
 *           MARIO_Y_FRAC, MARIO_SPRITE_CODE, MARIO_Y, MARIO_AIR_START_Y, SND_TRIGGER
 *           — names.js.
 */
import {
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_SPRITE_CODE, MARIO_Y,
  MARIO_AIR_START_Y, SND_TRIGGER,
} from "./names.js";

/** Low-bits sprite state code for the jump pose (the facing bit is preserved). */
const SPRITE_STATE_JUMP = 0x0e;

/**
 * @param {import("../../machine.js").Machine} m
 * @param {number} vxHi  high byte of the launch horizontal velocity (caller's B)
 * @param {number} vxLo  low  byte of the launch horizontal velocity (caller's C)
 */
export function launchMarioJump(m, vxHi, vxLo) {
  const { mem } = m;

  // Airborne velocity: horizontal from jump-init's choice, vertical the fixed
  // upward jump impulse 0x0148 (big-endian, hi at MARIO_AIR_VY_HI).
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
