// SPDX-License-Identifier: GPL-3.0-only
import {
  STAGE_COUNTDOWN,
  ROUND_COUNTER,
  ANIM_FRAME_COUNTER,
  ANIM_SEQ_TABLE_12FB,
  ANIM_TABLE_3838,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceActorPositionByVelocity } from "./advanceActorPositionByVelocity.js";
import { dispatchActorSpawnBySubStateAndPaceCadence } from "./dispatchActorSpawnBySubStateAndPaceCadence.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { spawnChildActorIfInRange } from "./spawnChildActorIfInRange.js";
import { setActorAnimation } from "./setActorAnimation.js";

/**
 * advanceEnemyTravelAndSpawnChildActors — one enemy actor's per-frame travel tick.
 *
 * WHAT IT IS
 *   The per-object update tick for a travelling/spawner enemy actor. The actor is an entry in
 *   the game's actor-record array: a fixed-layout block of bytes whose fields carry the actor's
 *   position, motion step, animation state, and a scratch flag. This routine is called once per
 *   frame for one such record (the record is addressed by the Z80 IX register), and it does two
 *   jobs: it walks the actor smoothly across the playfield toward a per-round scheduled column,
 *   and — while it is travelling — it drops off child actors at the scheduled column. Once the
 *   actor has travelled far enough it stops travelling: it latches a "done" flag and switches
 *   its animation to the descent sequence, after which later frames move it by its velocity
 *   rather than re-walking this schedule.
 *
 *   ROM 0x12af-0x12fa.  Grounding: [seen].
 *
 * ROLE IN THE MACHINE
 *   This is the object-travel half of the enemy-spawning subsystem. An enemy that has been
 *   launched into play travels along its lane; this tick is what advances that travel and, at
 *   the scheduled moment, releases the child actor the wave needs. The "scheduled column" comes
 *   from a per-round table so the spawn pattern changes as the round counter climbs.
 *
 * RECORD FIELDS (offsets from the record base `rec`)
 *   rec+0x05  fine sub-position accumulator (the fractional part of the travel position)
 *   rec+0x06  coarse position — whole travel columns / lap counter (the integer part)
 *   rec+0x08  latched-done flag — nonzero once travel is finished
 *   rec+0x09  per-tick sub-position step (how fast the fine accumulator advances each frame)
 *
 * LIVE-OUT: memory only. This tick writes rec+0x05 (the new fine accumulator), rec+0x06 (bumped
 *   on a carry), and rec+0x08 (latched to 1 when travel ends); each delegate leaves its own
 *   effects in the record and in shared game state. The fine accumulator is also handed to the
 *   spawn-cadence dispatch / child-spawn guard as their working count.
 */

// Actor-record field offsets and the two branch thresholds, named for readability:
const FLAG_FIELD = 0x08; //   rec+0x08: latched-done flag (nonzero once travel is finished)
const SUB_FIELD = 0x05; //    rec+0x05: fine sub-position accumulator (fractional travel position)
const STEP_FIELD = 0x09; //   rec+0x09: per-tick sub-position step added to the accumulator each frame
const COARSE_FIELD = 0x06; // rec+0x06: coarse position / lap counter (whole travel columns)
const STAGE_GATE = 0x03; //   STAGE_COUNTDOWN below this -> take the spawn-cadence dispatch path
const TARGET_LIMIT = 0x14; // coarse counter at/beyond this -> stop travelling: latch done and restart anim

export function advanceEnemyTravelAndSpawnChildActors(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the record's animation first (frame-hold countdown + script walk), every frame,
  // regardless of which travel path follows. Then check the latched-done flag (rec+0x08): once
  // an actor has finished its travel schedule this flag is set, and from then on the actor is
  // simply carried by its velocity — so hand off to the velocity mover and do no travel work.
  advanceObjectAnimationFrame(m, rec);
  if (mem8[rec + FLAG_FIELD] !== 0) return advanceActorPositionByVelocity(m, rec);

  // TRAVEL: advance the fixed-point position. The fine accumulator (rec+0x05) holds the
  // fractional part; adding the per-tick step (rec+0x09) moves the actor smoothly. When the
  // 8-bit accumulator overflows past 0xff it means one whole column has been crossed, so carry
  // +1 into the coarse counter (rec+0x06, the integer part). Keep only the low byte as the new
  // accumulator and store it back into rec+0x05.
  const sum = mem8[rec + SUB_FIELD] + mem8[rec + STEP_FIELD];
  if (sum > 0xff) mem8[rec + COARSE_FIELD] = mem8[rec + COARSE_FIELD] + 1; // carry into coarse
  const accum = sum & 0xff;
  mem8[rec + SUB_FIELD] = accum;

  // Stage-phase gate: STAGE_COUNTDOWN (0x8901) counts down from 0x20 across a stage. On its
  // final counts (once it has dropped below STAGE_GATE = 3) the actor's own travel schedule is
  // set aside and control passes to the spawn-cadence dispatch, which paces spawning off the
  // record's sub-state; the fine accumulator is forwarded as that dispatch's working count. For
  // the bulk of the stage (countdown >= 3) fall through to the scheduled-column travel below.
  if (mem8[STAGE_COUNTDOWN] < STAGE_GATE) return dispatchActorSpawnBySubStateAndPaceCadence(m, rec, accum);

  // Look up this round's scheduled target column. First derive a sub-table index from the round
  // counter ROUND_COUNTER (0x8907): mask to the low 5 bits and divide by 4, giving 0..7 — the
  // round group. That indexes the word table at ANIM_SEQ_TABLE_12FB (ROM 0x12fb) to get the
  // base pointer of this group's target-column table. Then index that table by the low nibble of
  // the global animation frame counter ANIM_FRAME_COUNTER (0x8d41) to read the target column for
  // the current frame slot.
  const seqIdx = (mem8[ROUND_COUNTER] & 0x1f) >> 2;
  const tableBase = fetchWordFromTableIndex(m, seqIdx, ANIM_SEQ_TABLE_12FB);
  const [target] = fetchByteFromTableIndex(m, tableBase, mem8[ANIM_FRAME_COUNTER] & 0x0f);

  // Compare where the actor has travelled to (coarse counter, rec+0x06) against that scheduled
  // column. If it has just landed on the scheduled column, release a child actor — the fine
  // accumulator is passed as the in-range guard (an out-of-range value makes the spawn a no-op).
  // If it has not reached the column yet and is still short of the travel limit (0x14), it is
  // simply still travelling, so return and let the next frame carry it further.
  const coarse = mem8[rec + COARSE_FIELD];
  if (coarse === target) return spawnChildActorIfInRange(m, accum);
  if (coarse < TARGET_LIMIT) return; // still travelling

  // Travel is over: the coarse counter has reached/passed the travel limit (0x14) without ever
  // matching the scheduled column. Latch the done flag (rec+0x08 = 1) so future frames take the
  // velocity-mover branch at the top, and restart the record on the descent animation sequence
  // ANIM_TABLE_3838 (ROM 0x3838) — the actor transitions from travelling to descending.
  mem8[rec + FLAG_FIELD] = 0x01;
  return setActorAnimation(m, rec, ANIM_TABLE_3838);
}
