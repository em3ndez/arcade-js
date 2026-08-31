// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6931 } from "./loc_6931.js";
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
 * spawnPairedEnemyOnDelaySweep — delay-gated enemy spawn sweep.
 *
 * While the shared frame-delay timer is running it just decrements it and returns. Once the timer
 * is clear it spawns nothing when the wave has already fully arrived (WAVE_NUMBER caught up to the
 * arrival count) or the wave limit is reached; otherwise it walks eight enemy/state record pairs
 * and spawns into the first empty one. The per-pair spawn returns true for an already-active pair
 * (keep sweeping) and false the moment it spawns (abort the sweep) — so at most one pair spawns per call.
 *
 * LIVE-OUT: none — the caller resumes on its own state; only the memory effects remain.
 */
export function spawnPairedEnemyOnDelaySweep(m) {
  const { mem8 } = m;

  if (mem8[SHARED_FRAME_DELAY_TIMER] !== 0) {
    mem8[SHARED_FRAME_DELAY_TIMER] = mem8[SHARED_FRAME_DELAY_TIMER] - 1;
    return;
  }

  const wave = mem8[WAVE_NUMBER];
  if (wave === mem8[WAVE_ARRIVAL_COUNTER]) return; // wave already fully arrived
  if (wave >= WAVE_LIMIT) return;

  let ix = ENEMY_ACTOR_TABLE;
  let iy = OBJECT_STATE_RECORD_BASE;
  for (let n = 0; n < RECORD_PAIRS; n++) {
    if (!loc_6931(m, ix, iy)) return; // spawned -> abort the sweep
    ix = u16(ix + RECORD_STRIDE);
    iy = u16(iy + RECORD_STRIDE);
  }
}
