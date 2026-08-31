// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { TURN_COLUMN_LIMIT, ANIM_SCRIPT_4203 } from "./names.js";
/**
 * latchColumnLimitAndArmTurnAnimation — arm an actor's turn animation from an interior entry point.
 *
 * WHAT IT IS
 * ----------
 * A moving object on the playfield — a hunter riding a rope, a launched arrow, a spawned
 * prize — is a stride-0x18 ACTOR RECORD in work RAM. As such an object marches sideways
 * across the field, one shared cell, TURN_COLUMN_LIMIT (0x8d4b), holds the tile-column
 * threshold at which the object should stop travelling and switch to its "turn-around"
 * animation. The X-movement handler compares the object's current column against that
 * threshold each frame; when the object reaches it, the object flips its look and reverses.
 *
 * This routine is the ARM half of that mechanism, entered from an interior point: it forces
 * the threshold cell to the "already at the limit" sentinel and immediately retargets the
 * actor record at the fixed turn-around animation script, restarting it from frame 0. It is
 * the mirror of the object handler at ROM 0x4221 — same tail, but this door skips the
 * animation-tick and the state branch and goes straight to latch-and-arm. It has a sibling,
 * clearColumnLimitAndArmTurnAnimation, which arms the same style of turn but leaves the
 * threshold at 0 (the "not yet reached" value) instead of the sentinel; which of the two is
 * used is chosen by a flag bit in the record (bit0 of the record's +0x08 byte) by the
 * caller countdownThenRearmTurnAnimationByFlag.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Object state handler helper — the "begin the turn immediately" trigger for a marching object.
 * TURN_COLUMN_LIMIT is watched by the column-advance handler (advanceActorColumnAndArmTurnOrBand,
 * ROM 0x343e) and by moveFormationAndSpawnObject; storing the sentinel here makes the object
 * treat itself as having hit the turn column on the very next comparison, so the turn begins
 * this frame rather than after further travel.
 *
 * ROM ADDRESS: 0x425c (interior entry into the 0x4221 object handler's tail).
 * GROUNDING: [seen] — the turn-arm role of this routine and the turn-column-limit cell it
 * writes are confirmed; the exact frames of the 0x4203 turn-animation script remain [code].
 *
 * LIVE-OUT: memory only — the turn-column limit cell (0x8d4b) set to the sentinel, plus the
 * actor record's animation-sequence pointer (+0x0c/+0x0d) and frame index (+0x0e) rewritten
 * to play the turn script from its start. No register is handed back; the callers that arm a
 * turn consume nothing from this routine.
 */

const TURN_ARMED = 0xff; // sentinel stored into the turn-column limit flag: "object is already at the turn column, begin the turn"

export function latchColumnLimitAndArmTurnAnimation(m, rec = m.regs.ix) {
  // rec is the base address of the actor record being retargeted; it defaults to the record
  // the object-state machinery is currently working on (the IX-selected record).
  const { mem8 } = m;

  // STEP 1 — Latch the turn threshold to the "at the limit" sentinel.
  // TURN_COLUMN_LIMIT (0x8d4b) is the shared column threshold the X-movement handler checks
  // each frame to decide when a marching object should turn around. Writing 0xff here means
  // the object is treated as having reached its turn column immediately, so the turn fires this
  // frame rather than after more sideways travel. (The sibling arm leaves this at 0 instead.)
  mem8[TURN_COLUMN_LIMIT] = TURN_ARMED;

  // STEP 2 — Point the record at the fixed turn-around animation script and restart it.
  // ANIM_SCRIPT_4203 (0x4203) is the turn-animation sequence table (a short loop of
  // {attribute, tile, colour} frames). Installing it through setActorAnimation writes its
  // pointer into the record's animation field (+0x0c/+0x0d) and forces the frame index (+0x0e)
  // back to 0, so the actor visibly begins the turn from the first frame of that script.
  setActorAnimation(m, rec, ANIM_SCRIPT_4203);
}
