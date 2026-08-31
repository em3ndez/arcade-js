// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceEnemyVerticalAndDispatchByAltitude } from "./advanceEnemyVerticalAndDispatchByAltitude.js";
import { advanceTravelingEnemyToArrival } from "./advanceTravelingEnemyToArrival.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * advanceEnemyActorMotion — per-frame motion + animation handler for one enemy actor.
 *
 * WHAT IT IS
 *   One state handler in the enemy-actor state machine. Every frame the arena sweep walks the
 *   enemy pool at ENEMY_ACTOR_TABLE (0x8ae0) — one 0x18-byte record per slot — and hands each live
 *   record to the per-record dispatcher, which masks the record's state byte (+0x02) to five bits
 *   and jumps through the rst-0x28 state table (the entry for this state, dw 0x39af, lives at
 *   0x33a5). That is how control arrives here. The record being serviced is the one whose base
 *   address is in IX (`rec`).
 *
 * ROLE IN THE MACHINE
 *   This is the "moving enemy" state: an actor that is both playing an animation and travelling
 *   across the arena. The routine does two things per frame — it steps the actor's sprite
 *   animation, then it moves the actor — and it alternates the KIND of movement by the parity of
 *   the round-frame counter, so a diving enemy advances horizontally toward its arrival column on
 *   one frame and integrates its vertical fall (the path that can decide to fire/drop) on the next.
 *   Splitting the two axes across alternate frames halves the per-frame work and gives the motion
 *   its characteristic stepped cadence.
 *
 * ROM 0x39af (rst-0x28 dispatch target).
 * Grounding: [seen]
 *
 * LIVE-OUT: none — a void state handler. All effect lands in the IX actor record (its animation
 *   fields, and its position/state fields) and in the shared round state the callees touch.
 */
export function advanceEnemyActorMotion(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Step 1: advance the sprite animation, unconditionally --------------------------------
  // Tick this actor's animation sequencer (advanceObjectAnimationFrame, ROM 0x4006). It counts
  // down the frame-hold at +0x0e and, only when that reaches zero, walks the record's animation
  // script via the pointer at +0x0c/+0x0d to pull the next frame — new tile into +0x10, colour
  // attribute into +0x0f, fresh hold into +0x0e. Animation advance is independent of motion, so it
  // runs on every frame regardless of which mover the parity branch below selects.
  advanceObjectAnimationFrame(m, rec); // step the animation sequencer

  // --- Step 2: move the actor, choosing the axis by round-frame parity -----------------------
  // ROUND_COUNTER (0x8907) ticks once per round-frame; its low bit is used here as a two-frame
  // ping-pong that alternates the motion phase. When the bit is CLEAR (even frame) the actor runs
  // its horizontal-travel phase — advanceTravelingEnemyToArrival (ROM 0x3b87) — which walks a
  // travelling enemy (one whose +0x08 bit 0 is clear) toward its arrival column.
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return advanceTravelingEnemyToArrival(m, rec); // even frame -> horizontal travel

  // When the bit is SET (odd frame) the actor runs its vertical mover —
  // advanceEnemyVerticalAndDispatchByAltitude (ROM 0x39ba) — which integrates the actor's vertical
  // position (+0x03 low, carrying into +0x04 high) by its velocity (+0x0a), then branches on the
  // state byte (+0x07) and the new altitude to reach the fire/drop decision path.
  return advanceEnemyVerticalAndDispatchByAltitude(m, rec); // odd frame -> vertical mover
}
