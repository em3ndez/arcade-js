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
 * advanceEnemyTravelAndSpawnChildActors — per-object travel tick for the actor record based at IX.
 *
 * Steps the record's animation, then: if it is already flagged (rec+0x08) it delegates to the
 * velocity mover. Otherwise it accumulates the sub-position (rec+0x05 += rec+0x09), carrying into
 * the coarse counter (rec+0x06). Before the stage is fully counted down it delegates to the
 * spawn-cadence dispatch. Past that it fetches this round's target column from the sequence table
 * (indexed by the round counter, then by the animation frame): reaching it spawns a child, still
 * short of 0x14 it keeps travelling, and at/beyond 0x14 it latches the flag and restarts the
 * record on the shared animation sequence.
 *
 * REGISTER BRIDGE: rec = m.regs.ix. LIVE-OUT: memory only — the record fields and each delegate's
 * effect; the accumulator is forwarded to the spawn-cadence / child-spawn guards as their count.
 */

const FLAG_FIELD = 0x08; //   latched-done flag
const SUB_FIELD = 0x05; //    sub-position accumulator
const STEP_FIELD = 0x09; //   per-tick sub-position step
const COARSE_FIELD = 0x06; // coarse position / lap counter
const STAGE_GATE = 0x03; //   stage countdown below this: spawn-cadence path
const TARGET_LIMIT = 0x14; // coarse counter at/beyond this: latch and restart

export function advanceEnemyTravelAndSpawnChildActors(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);
  if (mem8[rec + FLAG_FIELD] !== 0) return advanceActorPositionByVelocity(m, rec);

  const sum = mem8[rec + SUB_FIELD] + mem8[rec + STEP_FIELD];
  if (sum > 0xff) mem8[rec + COARSE_FIELD] = mem8[rec + COARSE_FIELD] + 1; // carry into coarse
  const accum = sum & 0xff;
  mem8[rec + SUB_FIELD] = accum;

  if (mem8[STAGE_COUNTDOWN] < STAGE_GATE) return dispatchActorSpawnBySubStateAndPaceCadence(m, rec, accum);

  const seqIdx = (mem8[ROUND_COUNTER] & 0x1f) >> 2;
  const tableBase = fetchWordFromTableIndex(m, seqIdx, ANIM_SEQ_TABLE_12FB);
  const [target] = fetchByteFromTableIndex(m, tableBase, mem8[ANIM_FRAME_COUNTER] & 0x0f);

  const coarse = mem8[rec + COARSE_FIELD];
  if (coarse === target) return spawnChildActorIfInRange(m, accum);
  if (coarse < TARGET_LIMIT) return; // still travelling

  mem8[rec + FLAG_FIELD] = 0x01;
  return setActorAnimation(m, rec, ANIM_TABLE_3838);
}
