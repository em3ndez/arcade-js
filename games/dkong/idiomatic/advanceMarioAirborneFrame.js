// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceMarioAirborneFrame — the airborne frame's head: snapshot Mario's pre-motion position,
 * advance his jump/fall arc one frame, then let the horizontal position gate steer him.
 *
 * The movement state machine vectors here on every frame Mario is airborne — every frame of a
 * jump or a fall. Three things happen, in order:
 *
 *  1. MARIO_X and MARIO_Y are copied into MARIO_AIR_PREV_X / MARIO_AIR_PREV_Y, so this
 *     frame's *starting* position survives the motion below — the collision code reads that
 *     pair back to test the swept segment rather than only the new point.
 *  2. The ballistic step integrates one frame of the arc: X drifts by the horizontal
 *     velocity, Y takes the vertical velocity plus the ramping gravity term.
 *  3. The horizontal travel limit classifies the NEW X (and Y, and the board parity) into a
 *     two-flag verdict, and the flags pick which way Mario is pushed for the rest of the
 *     frame:
 *       - first flag raised -> handled here: horizontal velocity is forced to +0.5 px/frame
 *                              (drift right) and the sprite's facing bit is set to face right;
 *       - otherwise         -> the far-right arm, which mirrors that at the far-right
 *                              playfield limit (velocity -0.5 px/frame, facing bit cleared)
 *                              and otherwise leaves the velocity alone.
 *     Both arms converge on the landing / fatal-fall tail.
 *
 * So the routine is the edge-steering half of the airborne frame: near the left playfield
 * limit — an interior wall on 25m and 75m, not the screen edge — it nudges Mario back inward,
 * and it always leaves the pre-motion position where the collision pass expects it.
 *
 * Mario's whole context block is addressed off its base, which this routine loads and
 * everything below it inherits. What the tails read from here is that base plus the position
 * gate's second verdict flag, which stays in the register bank.
 *
 * LIVE-OUT: memory, plus whatever the tail cascade leaves. This routine's own writes are
 * MARIO_AIR_PREV_X, MARIO_AIR_PREV_Y, MARIO_AIR_VX_HI, MARIO_AIR_VX_LO and MARIO_SPRITE_CODE,
 * on top of everything the ballistic step and the tail cascade write. Two register residues
 * are dead: C, which the ballistic step no longer leaves holding a velocity operand, and the
 * verdict register the branch decision decrements — the far-right arm reads only the OTHER
 * verdict flag and recomputes the condition flags before anything looks at them.
 */

import {
  MARIO_ACTIVE,
  MARIO_X,
  MARIO_Y,
  MARIO_SPRITE_CODE,
  MARIO_AIR_PREV_X,
  MARIO_AIR_PREV_Y,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
} from "./names.js";
import { stepBallisticMotion } from "./stepBallisticMotion.js";
import { limitMarioHorizontalTravel } from "./limitMarioHorizontalTravel.js";
import { loc_1bf2 } from "./loc_1bf2.js";
import { reverseMarioVerticalArc } from "./reverseMarioVerticalArc.js";

// Bit 7 of MARIO_SPRITE_CODE is the sprite's horizontal-flip bit: set = facing right.
const FACING_RIGHT = 0x80;

export function advanceMarioAirborneFrame(m) {
  const { regs, mem } = m;

  // Mario's context block is the record every step of this path works off; the tails below
  // inherit the base from here.
  regs.ix = MARIO_ACTIVE; // base of Mario's context block

  // Snapshot where this frame started, before any motion — the collision pass reads it back.
  mem.write8(MARIO_AIR_PREV_X, mem.read8(MARIO_X));
  mem.write8(MARIO_AIR_PREV_Y, mem.read8(MARIO_Y));

  // Advance one frame of the ballistic arc, then classify the position it landed on. The
  // gate's second flag stays in the register bank for the far-right arm, its only consumer.
  stepBallisticMotion(m);
  const { d: pushRight } = limitMarioHorizontalTravel(m);

  // Not the push-right verdict: hand over to the far-right-edge arm, which decides between
  // the mirrored left push and leaving the horizontal velocity untouched.
  if (pushRight !== 1) return loc_1bf2(m);

  // Push right: drift at +0.5 px/frame (the velocity is in 1/256 px units) and face right.
  mem.write8(MARIO_AIR_VX_HI, 0);
  mem.write8(MARIO_AIR_VX_LO, 128);
  mem.write8(MARIO_SPRITE_CODE, mem.read8(MARIO_SPRITE_CODE) | FACING_RIGHT);

  return reverseMarioVerticalArc(m);
}
