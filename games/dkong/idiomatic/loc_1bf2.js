// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bf2 — the airborne handler's leftward-nudge arm: stamp the left drift and pose when
 * the position gate raises its left verdict, otherwise leave the jump untouched.
 *
 * Reached by a tail branch from the airborne handler. By the time control arrives, that
 * handler has snapshotted Mario's pre-motion position, run one ballistic integration step,
 * and asked the horizontal position gate for its verdict — a two-flag pair of which at most
 * one half is ever raised. The handler consumed the RIGHT half itself (writing the
 * mirror-image rightward drift and setting the facing bit); it branches here with the LEFT
 * half still sitting in the register bank, which is the only thing this routine decides on.
 *
 *   - Verdict NOT raised — the gate wants no horizontal nudge. Nothing about the jump
 *     changes: the routine hands straight on to the shared airborne dispatch, leaving the
 *     velocity, the pose AND the current ballistic arc exactly as they were.
 *
 *   - Verdict raised — the gate raises it on exactly one exit, Mario's X at or past the
 *     right-hand screen limit, so this is the "he has run out of screen on the right"
 *     case. Two cells are stamped, and nothing else:
 *       * MARIO_AIR_VX_HI:MARIO_AIR_VX_LO takes the signed 16-bit value −128, half a pixel
 *         per frame leftward — same magnitude, opposite sign to the rightward drift the
 *         mirror arm writes and to the leftward launch velocity a jump commits at take-off.
 *       * MARIO_SPRITE_CODE's facing bit (bit 7, the horizontal flip; 1 = facing right) is
 *         CLEARED, turning Mario to face the way he is now being pushed. The pose bits below
 *         it are read back and preserved — this is a bit clear, not a store.
 *     Control then continues into the vertical half of the same reflection, which re-bases
 *     the ballistic arc at Mario's present position before rejoining the same airborne
 *     dispatch the other arm went to directly. So the reflection is split across two
 *     routines: the horizontal half here, the vertical half there.
 *
 * REGISTER BOUNDARY. The verdict is read out of the register bank rather than taken as a
 * parameter, because that is how both entry paths hand it over — the position gate mirrors
 * its honest return into those registers for exactly this reason.
 *
 * The context-block base register is pinned to Mario's block by the sole entry, which loads
 * it and leaves it alone on the way here. That is what lets this routine's own cells be named
 * outright instead of reached as record offsets, and the vertical half still reads Mario's
 * record through the same register.
 *
 * LIVE-OUT: memory-only, plus the tail's return value, forwarded unchanged because the
 * airborne cascade above uses it for the caller-skip convention.
 */

import { MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_SPRITE_CODE } from "./names.js";
import { reverseMarioVerticalArc } from "./reverseMarioVerticalArc.js";

/** Horizontal-flip / facing bit of MARIO_SPRITE_CODE (1 = facing right). */
const FACING_BIT = 0x80;

/** Leftward airborne drift: the signed 16-bit value −128, half a pixel per frame. */
const DRIFT_LEFT_HI = 0xff;
const DRIFT_LEFT_LO = 0x80;

export function loc_1bf2(m) {
  const { regs, mem } = m;

  // The gate's leftward verdict, handed over in the register bank. It is raised only for
  // Mario past the right-hand screen limit; every other verdict leaves the jump alone.
  if (regs.e !== 1) {
    return m.call(0x1c05); // straight on to the airborne dispatch — velocity and arc untouched
  }

  // Push him back inboard at half a pixel per frame, and turn him to face that way.
  mem.write8(MARIO_AIR_VX_HI, DRIFT_LEFT_HI);
  mem.write8(MARIO_AIR_VX_LO, DRIFT_LEFT_LO);
  mem.write8(MARIO_SPRITE_CODE, mem.read8(MARIO_SPRITE_CODE) & ~FACING_BIT);

  // The vertical half of the same reflection: re-base the arc at Mario's present position,
  // then on into the shared airborne dispatch.
  return reverseMarioVerticalArc(m);
}
