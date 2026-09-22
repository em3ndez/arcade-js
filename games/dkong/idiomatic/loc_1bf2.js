// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bf2 — the airborne handler's leftward-nudge arm. On the gate's left verdict (leftVerdict === 1,
 * defaulting from regs.e; raised only for Mario at or past the right-hand screen limit) stamp the leftward drift into
 * MARIO_AIR_VX_HI:LO, clear MARIO_SPRITE_CODE's facing bit, and continue into the vertical half
 * of the reflection. Otherwise leave the jump untouched and hand on to the airborne dispatch.
 *
 * LIVE-OUT: memory-only, plus the tail's return value, forwarded unchanged because the
 * airborne cascade above uses it for the caller-skip convention.
 */

import { MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_SPRITE_CODE } from "./names.js";
import { reverseMarioVerticalArc } from "./reverseMarioVerticalArc.js";
import { loc_1c05 } from "./loc_1c05.js";

/** Horizontal-flip / facing bit of MARIO_SPRITE_CODE (1 = facing right). */
const FACING_BIT = 0x80;

/** Leftward airborne drift: the signed 16-bit value −128, half a pixel per frame. */
const DRIFT_LEFT_HI = 0xff;
const DRIFT_LEFT_LO = 0x80;

export function loc_1bf2(m, _ctx, leftVerdict = m.regs.e) {
  const { mem8 } = m;

  if (leftVerdict !== 1) {
    return loc_1c05(m);
  }

  mem8[MARIO_AIR_VX_HI] = DRIFT_LEFT_HI;
  mem8[MARIO_AIR_VX_LO] = DRIFT_LEFT_LO;
  mem8[MARIO_SPRITE_CODE] = mem8[MARIO_SPRITE_CODE] & ~FACING_BIT;

  return reverseMarioVerticalArc(m);
}
