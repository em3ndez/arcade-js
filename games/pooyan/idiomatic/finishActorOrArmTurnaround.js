// SPDX-License-Identifier: GPL-3.0-only
import { PLAY_STATE_INDEX, ANIM_TABLE_3829, ANIM_TABLE_3847 } from "./names.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { setActorAnimation } from "./setActorAnimation.js";
/**
 * finishActorOrArmTurnaround — close out one step of an actor's horizontal move.
 *
 * WHAT IT IS
 *   ROM 0x3775-0x379c. Grounding: [seen].
 *
 *   Every moving thing on the board — the enemy hunters walking a girder, the objects they
 *   carry, and the rest — is kept as a fixed-stride ACTOR RECORD in work RAM. Each frame an
 *   actor's X position is advanced by its per-record step; this routine is the TAIL of that
 *   advance, run once the new X has been written. It decides what the actor does now that a
 *   move step has landed: either retire the actor when the board is finishing, or flip it into
 *   a turn-around animation as it reaches the end of a pass.
 *
 *   The choice hangs on two record fields:
 *     - the MOVE COUNTER at rec+6 — a down-counter of how many passes the actor has left in its
 *       current move; each completed pass decrements it, and it reaching the low end means the
 *       move is done.
 *     - the FACING / VARIANT FLAG at rec+7 — bit 1 chooses which of two turn-around animation
 *       sequences the actor should play.
 *   and on one global: the in-play sub-state index at PLAY_STATE_INDEX (0x880a), whose value 5
 *   is the board's "finish" phase.
 *
 * ROLE IN THE MACHINE
 *   This is the end-of-move dispatch for an actor. It is reached at the end of the per-actor X
 *   advance and through the end-of-move guard (which only lets an actor in here when its
 *   end-of-move bit is set). Two distinct jobs share the one routine, selected by the play
 *   sub-state:
 *     - FINISH PHASE (0x880a == 5): tear the actor down. Once its move counter has drained to
 *       zero the actor's sprite band is blanked so it vanishes from the screen; until then it is
 *       left alone to keep moving.
 *     - EVERY OTHER PHASE: arm a turn-around. As the actor nears the end of a pass (move counter
 *       below two, i.e. 0 or 1) it is flipped into a turn-around animation so it visibly reverses;
 *       a counter of two or more means the actor is still mid-pass and nothing happens.
 *
 * LIVE-OUT: none that a caller consumes. The exit register A carries the move counter (rec+6),
 * but the end-of-move subtree reloads A and reads no register back; the real effects are the
 * memory writes — a blanked sprite band on the finish path, or a cleared anim latch (rec+8) plus
 * a retargeted animation on the turn-around path.
 */

const FINISH_PHASE = 0x05; // PLAY_STATE_INDEX value 5 = the board's finish phase (retire actors)
const TURNAROUND_MAX = 0x02; // move counter must be below this (0 or 1) to arm the turn animation
const REC_MOVE_COUNTER = 0x06; // rec+6: down-counter of remaining passes; gates the move's end
const REC_FLAG_BYTE = 0x07; // rec+7: facing/variant flag — bit 1 selects the turn-around sequence
const REC_ANIM_LATCH = 0x08; // rec+8: animation latch, cleared before the turn animation is armed
const FLAG_TURN_VARIANT = 0x02; // bit 1 of the flag byte — the turn-around-variant selector

export function finishActorOrArmTurnaround(m, rec = m.regs.ix) {
  const { mem8 } = m;
  // Read the actor's move counter (rec+6) up front — both jobs below key off it: the finish
  // path retires the actor only at zero, the turn-around path arms only while it is below two.
  const counter = mem8[rec + REC_MOVE_COUNTER];

  // FINISH PHASE. The board's in-play sub-state at 0x880a holds 5 while a finished board is
  // clearing out its actors. In this phase the routine never arms an animation — its only job is
  // to retire the actor once its move has fully run down.
  if (mem8[PLAY_STATE_INDEX] === FINISH_PHASE) {
    // The move counter has drained to zero: the actor's move is complete, so erase its sprite
    // band (zero the leading run of the record) and the actor disappears on the next frame. A
    // still-counting actor (counter != 0) is left in place to keep moving.
    if (counter === 0) blankActorSpriteBand(m, rec); // finish: blank the sprite band
    // Exit with the counter in A; the finish phase does nothing else here.
    return (m.regs.a = counter);
  }

  // OUTSIDE the finish phase: this is a turn-around arm. It only fires as the actor nears the end
  // of a pass — move counter 0 or 1. A counter of two or more means the actor is still mid-pass,
  // so leave it untouched and return.
  if (counter >= TURNAROUND_MAX) return (m.regs.a = counter);

  // Clear the actor's animation latch (rec+8) so the fresh turn-around animation about to be
  // armed is not suppressed by a leftover latched value.
  mem8[rec + REC_ANIM_LATCH] = 0x00;
  // Pick which of the two turn-around sequences to play from bit 1 of the actor's facing/variant
  // flag (rec+7): set selects the variant table (ANIM_TABLE_3847), clear the default one.
  const turnVariant = (mem8[rec + REC_FLAG_BYTE] & FLAG_TURN_VARIANT) !== 0;
  // Point the actor's record at the chosen turn-around animation sequence and restart it from
  // frame 0, so the actor visibly reverses direction at the end of its pass.
  setActorAnimation(m, rec, turnVariant ? ANIM_TABLE_3847 : ANIM_TABLE_3829);
  // Exit with the move counter in A (unread by the caller); the turn-around is now armed.
  return (m.regs.a = counter);
}
