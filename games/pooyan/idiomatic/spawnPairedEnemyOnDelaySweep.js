// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { spawnPairedEnemyRecordAndAnnounceWave } from "./spawnPairedEnemyRecordAndAnnounceWave.js";
import {
  SHARED_FRAME_DELAY_TIMER,
  WAVE_NUMBER,
  WAVE_ARRIVAL_COUNTER,
  ENEMY_ACTOR_TABLE,
  OBJECT_STATE_RECORD_BASE,
} from "./names.js";

const RECORD_PAIRS = 8; //    enemy/state record pairs swept per call
const RECORD_STRIDE = 0x18; // between successive records in each table
const WAVE_LIMIT = 0x08; //   no spawning once WAVE_NUMBER reaches this

/**
 * spawnPairedEnemyOnDelaySweep — delay-gated, paired-record enemy spawn sweep.
 *
 * WHAT IT IS: one of the wave-release spawn drivers. When a wave is armed its members are not all
 * dropped on screen at once — they trickle in one at a time, and this routine is both the pacer and
 * the placer for that trickle. Every call it either burns one tick off the shared release delay or,
 * once that delay has run out, releases a single fresh enemy into the wave.
 *
 * ROLE IN THE MACHINE: an enemy lives as a pair of records in two parallel tables — the enemy-actor
 * record in ENEMY_ACTOR_TABLE (0x8ae0) and its companion object-state record in
 * OBJECT_STATE_RECORD_BASE (0x8ba0), both laid out at stride 0x18. Releasing an enemy means finding a
 * pair that is not yet in use and stamping it live. This routine owns the pacing (through the shared
 * per-frame delay counter) and the "who's next" search (the eight-pair sweep); the actual stamping of
 * a chosen pair — writing its coordinates, animation and flags, re-arming the delay, painting the HUD
 * count on the first spawn of a wave — is done by the per-pair spawn/init helper spawnPairedEnemyRecordAndAnnounceWave.
 *
 * ROM: 0x6905-0x6930.
 * Grounding: [seen]
 *
 * SHAPE OF A CALL:
 *   1. If the shared frame-delay timer SHARED_FRAME_DELAY_TIMER (0x8929) is still running, tick it
 *      down and return — no release this frame.
 *   2. Once the delay is clear, release nothing if the wave is finished: either the spawn-progress
 *      index WAVE_NUMBER (0x892d) has caught up to the per-stage arrival tally WAVE_ARRIVAL_COUNTER
 *      (0x8903), or WAVE_NUMBER has reached the eight-wave limit for the stage.
 *   3. Otherwise walk the eight enemy/state record pairs and hand each to spawnPairedEnemyRecordAndAnnounceWave, which stamps the
 *      first pair that is free. That helper returns true for an already-active pair (keep sweeping)
 *      and false the instant it spawns (abort the sweep) — so at most one pair is placed per call,
 *      i.e. exactly one enemy is released per elapsed delay.
 *
 * LIVE-OUT: none — the caller resumes on its own state. What remains is the memory effect: either
 * SHARED_FRAME_DELAY_TIMER decremented by one, or (via spawnPairedEnemyRecordAndAnnounceWave) one record pair stamped live and the
 * shared delay re-armed to time the next release.
 */
export function spawnPairedEnemyOnDelaySweep(m) {
  const { mem8 } = m;

  // STEP 1 — pace the release. SHARED_FRAME_DELAY_TIMER (0x8929) is a per-frame countdown shared by
  // several object-update sweeps; while it is nonzero this routine does nothing but spend one tick of
  // it and bail, so a wave drips out no faster than the delay allows. Only when the counter reaches
  // zero does a release become possible this frame.
  if (mem8[SHARED_FRAME_DELAY_TIMER] !== 0) {
    mem8[SHARED_FRAME_DELAY_TIMER] = mem8[SHARED_FRAME_DELAY_TIMER] - 1;
    return;
  }

  // STEP 2 — is the wave finished? Two counters bracket its progress: WAVE_NUMBER (0x892d), the 0..8
  // spawn-progress index bumped once per enemy released, and WAVE_ARRIVAL_COUNTER (0x8903), the
  // per-stage tally bumped once per enemy that reaches its arrival point. When WAVE_NUMBER has caught
  // up to WAVE_ARRIVAL_COUNTER the wave has fully arrived; when WAVE_NUMBER reaches WAVE_LIMIT (0x08)
  // all eight waves for the stage have been released. Either way there is nothing left to place, so
  // return without touching a record.
  const wave = mem8[WAVE_NUMBER];
  if (wave === mem8[WAVE_ARRIVAL_COUNTER]) return; // wave already fully arrived
  if (wave >= WAVE_LIMIT) return;

  // STEP 3 — find a free slot and release one enemy into it. The paired records live in
  // ENEMY_ACTOR_TABLE (0x8ae0) and OBJECT_STATE_RECORD_BASE (0x8ba0), RECORD_PAIRS (8) entries each,
  // laid out RECORD_STRIDE (0x18) bytes apart. Two cursors advance in lock-step across the eight
  // pairs — ix over the actor table, iy over the state table — each kept to a 16-bit address. Each
  // pair is offered to spawnPairedEnemyRecordAndAnnounceWave: a pair already in use (bit0 of its leading byte set) returns true
  // and the sweep moves on; the first free pair is stamped live (and the shared delay re-armed) and
  // returns false, which aborts the sweep here. So the loop places exactly one enemy and then stops,
  // even when later pairs are still free — one release per elapsed delay.
  let ix = ENEMY_ACTOR_TABLE;
  let iy = OBJECT_STATE_RECORD_BASE;
  for (let n = 0; n < RECORD_PAIRS; n++) {
    if (!spawnPairedEnemyRecordAndAnnounceWave(m, ix, iy)) return; // spawned -> abort the sweep
    ix = u16(ix + RECORD_STRIDE);
    iy = u16(iy + RECORD_STRIDE);
  }
}
