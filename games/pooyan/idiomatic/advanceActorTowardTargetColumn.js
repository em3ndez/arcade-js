// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceActorXAndDispatchMove } from "./advanceActorXAndDispatchMove.js";
import { dispatchActorPhaseGatedByDelay } from "./dispatchActorPhaseGatedByDelay.js";
import { enterPreSpawnGateIfBelowLimit } from "./enterPreSpawnGateIfBelowLimit.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  STAGE_COUNTDOWN,
  ACTIVE_LANE_COUNT,
  ROUND_COUNTER,
  ANIM_FRAME_COUNTER,
  ALT_TARGET_TABLE_PTR,
  SLOT_SPAWN_INDEX,
  TARGET_TILE_ROW_TABLE,
  ANIM_TABLE_3838,
  ANIM_TABLE_3856,
} from "./names.js";

/**
 * advanceActorTowardTargetColumn -- one frame of the horizontal movement + target-seek AI for a
 * single enemy actor. The record it operates on is a fixed-layout struct in the actor bands
 * (0x8a80 / 0x8ae0), pointed at by IX.
 *
 * ROM: 0x355b-0x35c6.
 * Grounding: [seen].
 *
 * ROLE IN THE MACHINE. During an attack wave the wolves walk sideways across the play field, one
 * tile column at a time, until they reach the column where they should turn and begin their
 * approach. This routine is that walk: every frame it steps the actor's animation, integrates its
 * horizontal position, and -- once the stage is far enough along -- looks up the column the actor
 * is supposed to seek and decides what to do about it. There are three outcomes for a moving actor:
 * it is sitting exactly on the target column (hand off to the pre-spawn guard), it is still too
 * close to the edge it entered from (leave it walking), or it has travelled far enough to commit,
 * at which point it "latches" onto the target and switches to its turn/approach animation. Once
 * latched, every later frame skips the seek entirely and just keeps walking.
 *
 * The target column comes from one of two sources. In normal play (no lanes active) it is read
 * from a per-round table: the round selects which row of target columns to use, and a rolling
 * frame counter picks a column within that row. When lane spawning is active the column instead
 * comes from an alternate lane table indexed by the per-slot spawn tally -- and a per-record flag
 * bit can make the actor skip the lookup altogether and just march to the range gate.
 *
 * The record fields this routine touches:
 *   rec+5 REC_X      fine (sub-tile) X -- the low byte of the actor's 16-bit horizontal position
 *   rec+6 REC_COLUMN coarse tile column -- the high byte; the value the target-seek compares
 *   rec+7 REC_FLAGS  per-record flags (bit1 picks the approach animation, bit2 gates the alt lookup)
 *   rec+8 REC_LATCH  "committed to target" flag -- nonzero once the actor has latched on
 *   rec+9 REC_STEP   per-record horizontal step (velocity) added to REC_X each frame
 *
 * LIVE-OUT. Persists the advanced REC_X (rec+5) and, on a tile-boundary crossing, the bumped
 * REC_COLUMN (rec+6); on the commit path it sets REC_LATCH (rec+8) = 1. The freshly advanced fine
 * X is also carried in B to the pre-spawn / phase tails. On the "too near" bail it leaves A = the
 * actor's coarse column for the caller; the other exits pass control to their tail handlers, which
 * set their own state.
 */

const REC_X = 0x05; // rec+5: fine (sub-tile) X -- low byte of the actor's 16-bit horizontal position
const REC_COLUMN = 0x06; // rec+6: coarse tile column -- high byte; the value the target-seek compares
const REC_FLAGS = 0x07; // rec+7: per-record flags (bit1 approach-anim select, bit2 alt-lookup gate)
const REC_LATCH = 0x08; // rec+8: "committed to target" flag -- nonzero once the actor has latched on
const REC_STEP = 0x09; // rec+9: per-record horizontal step (velocity) added to REC_X each frame
const MIN_STAGE = 0x03; // seek runs only while STAGE_COUNTDOWN (0x8901) is at least 3
const NEAR_LIMIT = 0x14; // coarse column below this: still too near the entry edge, bail without latching
const FLAG_SKIP_LOOKUP = 0x04; // REC_FLAGS bit2: when lanes are active and this is clear, skip the lookup
const FLAG_APPROACH_B = 0x02; // REC_FLAGS bit1: selects the second approach animation (ANIM_TABLE_3856)

export function advanceActorTowardTargetColumn(m, rec = m.regs.ix) {
  const { mem8, mem16 } = m;

  // Always tick this record's animation first (frame-hold countdown + script walk). ROM 0x355b.
  advanceObjectAnimationFrame(m, rec); // step the record's animation

  // Already-latched short-circuit (ROM 0x3561): once REC_LATCH (rec+8) is set the actor has already
  // committed to its target, so the whole seek below is dead weight -- hand straight to the plain
  // walk-and-dispatch handler (ROM 0x3757), which just advances X and dispatches on the stage timer.
  if (mem8[rec + REC_LATCH] !== 0) return advanceActorXAndDispatchMove(m, rec); // already latched

  // Integrate the horizontal position (ROM 0x3565): add the per-record step REC_STEP (rec+9) to the
  // fine X REC_X (rec+5). An overflow past 0xff means the actor just crossed a tile boundary, so the
  // carry bumps the coarse column REC_COLUMN (rec+6) by one. This is a fixed-point (column.fraction)
  // position where REC_COLUMN is the whole-tile part and REC_X the fraction.
  const sum = mem8[rec + REC_X] + mem8[rec + REC_STEP];
  if (sum > 0xff) mem8[rec + REC_COLUMN] = u8(mem8[rec + REC_COLUMN] + 1); // carry into the column
  const newX = u8(sum);
  mem8[rec + REC_X] = newX; // store the wrapped fine X back into the record (also carried in B to the tails)

  // Stage gate (ROM 0x3574): the target-seek runs only while STAGE_COUNTDOWN (0x8901), the per-stage
  // countdown, is at least MIN_STAGE. Since that cell counts down over the stage, the seek is live
  // for most of the stage and shuts off in its final few frames -- below 3 the record is handed to
  // dispatchActorPhaseGatedByDelay (ROM 0x362d), a phase dispatch gated by a per-actor delay.
  if (mem8[STAGE_COUNTDOWN] < MIN_STAGE) return dispatchActorPhaseGatedByDelay(m, rec, newX); // early stage

  // Resolve the target column. actorCol is the actor's current coarse column, tested both by the
  // on-target compare and the range gate below.
  const actorCol = mem8[rec + REC_COLUMN];

  // ACTIVE_LANE_COUNT (0x8d79) selects the source (ROM 0x357c): nonzero means lane spawning is
  // active, so the target comes from the alternate lane table; zero means read the primary per-round
  // table. When lanes are active AND this record's REC_FLAGS bit2 (FLAG_SKIP_LOOKUP) is clear, the
  // whole lookup + on-target compare is skipped and the actor's own column drops straight into the
  // range gate below (ROM 0x35b8 -> 0x35c2).
  const altSource = mem8[ACTIVE_LANE_COUNT] !== 0;
  if (!(altSource && (mem8[rec + REC_FLAGS] & FLAG_SKIP_LOOKUP) === 0)) {
    let base, index;
    if (altSource) {
      // Alternate lane source (ROM 0x35b4): base is the 16-bit pointer parked at ALT_TARGET_TABLE_PTR
      // (0x8d6f); index is the per-slot spawn tally SLOT_SPAWN_INDEX (0x8d7b).
      base = mem16[ALT_TARGET_TABLE_PTR];
      index = mem8[SLOT_SPAWN_INDEX];
    } else {
      // Primary per-round source (ROM 0x3582): the round selects which row of target columns to seek
      // -- (ROUND_COUNTER (0x8907) & 0x0f) >> 1 indexes a word out of TARGET_TILE_ROW_TABLE (0x35c7),
      // and the low three bits of the rolling ANIM_FRAME_COUNTER (0x8d41) pick one of eight columns
      // within that row.
      base = fetchWordFromTableIndex(m, (mem8[ROUND_COUNTER] & 0x0f) >> 1, TARGET_TILE_ROW_TABLE);
      index = mem8[ANIM_FRAME_COUNTER] & 0x07;
    }
    // Read the target tile column out of the chosen row (ROM 0x3595): the byte at base + index.
    const [targetCol] = fetchByteFromTableIndex(m, base, index);
    // On target (ROM 0x359a): if the actor's coarse column already equals the target column it is
    // sitting over the spot, so hand to the pre-spawn guard enterPreSpawnGateIfBelowLimit (ROM 0x3617),
    // passing the freshly advanced fine X.
    if (actorCol === targetCol) return enterPreSpawnGateIfBelowLimit(m, newX, rec); // on target -> pre-spawn guard
  }

  // Range gate (ROM 0x359e): if the actor is still below NEAR_LIMIT (0x14) coarse columns from the
  // edge it entered on, it is too near to commit -- bail, leaving the coarse column in A for the caller.
  if (actorCol < NEAR_LIMIT) return (m.regs.a = actorCol); // too near -> bail (A = actor column)

  // Commit (ROM 0x35a1): far enough across and not on the exact column, so latch the actor -- set
  // REC_LATCH (rec+8) = 1 so every later frame takes the already-latched short-circuit at the top.
  mem8[rec + REC_LATCH] = 0x01; // latch onto the target

  // Arm the approach animation (ROM 0x35a8): pick between the two turn/approach sequences by
  // REC_FLAGS bit1 (FLAG_APPROACH_B) -- clear selects ANIM_TABLE_3838, set selects ANIM_TABLE_3856 --
  // then point the record at it and restart it via setActorAnimation (ROM 0x381e).
  const anim = (mem8[rec + REC_FLAGS] & FLAG_APPROACH_B) === 0 ? ANIM_TABLE_3838 : ANIM_TABLE_3856;
  return setActorAnimation(m, rec, anim);
}
