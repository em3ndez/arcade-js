// SPDX-License-Identifier: GPL-3.0-only

/**
 * advanceEnemyState0AndArmFlapReset — the state-0 handler for one enemy actor.
 *
 * WHAT IT IS
 *   Each enemy actor lives in a fixed-layout record based at the index register (rec). A
 *   per-actor state machine dispatches on the record's state byte; this routine is the handler
 *   for state 0, the "hold, then turn" phase. Every frame it winds the record's state timer
 *   (rec+0x11) down by one. While the timer is still running the actor simply waits and the
 *   handler does nothing else. When the timer reaches zero the hold is over: it steps the
 *   record's animation frame counter (rec+0x02) and then decides how to leave state 0.
 *
 * ROLE IN THE MACHINE
 *   The exit is chosen by bit0 of the record's flap byte (rec+0x0b):
 *     - bit0 clear (the common case): fall straight into the shared turn-select tail,
 *       seatTurnAnimationFromColumnLimit, which looks up this actor's turn-column limit and
 *       seats the turn frame + animation for the direction it faces.
 *     - bit0 set: this expiry is also the one that re-seeds the shared wave/stage bookkeeping —
 *       the "flap-reset arm". It nudges the eagle/spawn target-column bias forward, re-latches
 *       the stage countdown, clears the spawn-active flag, disarms its own flap byte (so the arm
 *       is one-shot), runs the same turn-select tail to recompute the record's turn-select
 *       result (rec+0x08), and finally overrides the seated animation with a dedicated flap
 *       sprite sequence picked by bit0 of that turn-select result.
 *
 * ROM: 0x33bd-0x3416 (the flap-reset arm begins at 0x33f7).
 * Grounding: [seen]
 *
 * LIVE-OUT: none in registers — every effect is a memory write. It updates the record's timer
 *   (rec+0x11), frame counter (rec+0x02), turn-select result (rec+0x08), flap byte (rec+0x0b)
 *   and animation fields, and on the flap-reset arm also the eagle/spawn target-column bias
 *   (0x8d4c), the stage countdown (0x8901) and the spawn-active flag (0x8d4a). The dispatcher
 *   that runs this handler reads nothing back from it.
 */

import { u16 } from "../../../core/int.js";
import { seatTurnAnimationFromColumnLimit } from "./seatTurnAnimationFromColumnLimit.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  EAGLE_TARGET_COLUMN_BIAS,
  STAGE_COUNTDOWN,
  SPAWN_ACTIVE_FLAG,
  ANIM_TABLE_3847,
  ANIM_TABLE_3856,
} from "./names.js";

// Byte offsets into the enemy-actor record based at rec. The record packs its per-actor state
// into these fixed slots; this handler touches four of them plus the flap byte.
const OFF_FRAME = 0x02; //  animation frame counter, bumped on timer expiry
const OFF_SPRITE = 0x08; // turn-select result; bit0 picks the flap table
const OFF_FLAP = 0x0b; //   bit0 selects the flap-reset arm
const OFF_TIMER = 0x11; //  state countdown
// Value re-latched into the shared stage countdown (0x8901) when the flap-reset arm fires,
// restarting that stage timer window.
const FLAP_RESET_COUNTDOWN = 0x06; // stage countdown re-latched on the flap-reset arm

export function advanceEnemyState0AndArmFlapReset(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // State 0 is a timed hold. Wind the record's state timer (rec+0x11) down by one this frame;
  // while it has not reached zero the actor stays put, so return and do nothing more.
  mem8[u16(rec + OFF_TIMER)] = mem8[u16(rec + OFF_TIMER)] - 1; // tick the state timer
  if (mem8[u16(rec + OFF_TIMER)] !== 0) return; //               still counting -> idle

  // Hold expired. Step the record's animation frame counter (rec+0x02) so the sprite advances,
  // then choose how to leave state 0.
  mem8[u16(rec + OFF_FRAME)] = mem8[u16(rec + OFF_FRAME)] + 1; // advance the frame

  // Common exit: when bit0 of the flap byte (rec+0x0b) is clear, hand straight off to the shared
  // turn-select tail, which seats this actor's turn frame + animation from its turn-column limit.
  if ((mem8[u16(rec + OFF_FLAP)] & 0x01) === 0) {
    return seatTurnAnimationFromColumnLimit(m, rec); // fall into the shared turn-select tail
  }

  // Flap-reset arm (bit0 of the flap byte set). Beyond seating the turn animation, this expiry
  // re-seeds the shared wave/stage bookkeeping and installs a dedicated flap animation.

  // Nudge the eagle/spawn target-column bias (0x8d4c) forward by one, shifting where the next
  // spawn/target column lands.
  mem8[EAGLE_TARGET_COLUMN_BIAS] = mem8[EAGLE_TARGET_COLUMN_BIAS] + 1;
  // Re-latch the shared stage countdown (0x8901) to 6, restarting the stage timer window.
  mem8[STAGE_COUNTDOWN] = FLAP_RESET_COUNTDOWN;
  // Clear the spawn-active flag (0x8d4a): no spawn is currently in flight.
  mem8[SPAWN_ACTIVE_FLAG] = 0x00;
  // Disarm this record's flap byte (rec+0x0b) so the flap-reset arm fires only once.
  mem8[u16(rec + OFF_FLAP)] = 0x00;
  // Run the same turn-select tail as the common exit; here its job is to recompute the record's
  // turn-select result (rec+0x08), which the animation pick reads next.
  seatTurnAnimationFromColumnLimit(m, rec); // re-run the turn-select tail — recomputes rec+0x08
  // Override the seated animation with the flap sprite sequence: bit0 of the turn-select result
  // (rec+0x08) picks between the two turn-around variants (ANIM_TABLE_3856 / ANIM_TABLE_3847),
  // then point the record at it and restart the animation.
  const flapTable = mem8[u16(rec + OFF_SPRITE)] & 0x01 ? ANIM_TABLE_3856 : ANIM_TABLE_3847;
  return setActorAnimation(m, rec, flapTable);
}
