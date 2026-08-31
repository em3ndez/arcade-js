// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { spawnEnemyIntoFreeSlotCyclingAnim } from "./spawnEnemyIntoFreeSlotCyclingAnim.js";
import {
  BLINK_PHASE,
  ANIM_PHASE_TOGGLE_892C,
  BLINK_COUNTDOWN,
  ENEMY_ACTOR_TABLE,
} from "./names.js";

// ---------------------------------------------------------------------------
// The literal shape of the enemy-actor pool this driver walks, named so the
// sweep below reads as intent rather than magic numbers.
// ---------------------------------------------------------------------------
const RECORD_COUNT = 18; // enemy-actor records visited per sweep. 18 records at stride 0x18
// reaches from ENEMY_ACTOR_TABLE (0x8ae0) up to 0x8c90, so the walk deliberately runs on past the
// enemy pool proper and across the adjacent projectile and formation pools — every slot in that
// span exposes its liveness header at the same +0/+1 offset, and this driver treats the whole run
// as one flat array of candidate slots.
const RECORD_STRIDE = 0x18; // bytes between one record and the next; each record packs a full
// actor's per-frame state (header/liveness, state index, position, facing, animation cursor) into
// this fixed 0x18-byte cell.
const TOGGLE_GATE = 0x06; // value of the spawn-phase toggle (0x892c) that suspends the sweep
// entirely — while the toggle sits at this gate, no new enemy is allowed to appear.

/**
 * spawnEnemyOnBlinkCountdownSweep — enemy-spawn sweep driver.
 *
 * WHAT IT IS: one of the play-frame sub-handlers. Its job is to trickle new enemies into the arena
 * at a throttled cadence — at most one fresh enemy per eligible frame — by finding the first empty
 * slot in the enemy-actor pool and bringing an enemy to life in it.
 *
 * ROLE IN THE MACHINE: the enemy pool is a flat table of fixed-size records at ENEMY_ACTOR_TABLE
 * (0x8ae0), each 0x18 bytes, whose two-byte header doubles as a liveness flag (a slot is free when
 * bit 0 of both header bytes is clear). Other passes each frame sweep this same pool to advance
 * every live enemy's state and animation; THIS pass is the allocator that decides when and where a
 * new one is born. It never spawns on demand — it is rate-limited by a countdown so enemies arrive
 * as a steady stream rather than a flood.
 *
 * ROM address: 0x6a0f (0x6a0f-0x6a34).
 * Grounding: [seen].
 *
 * The frame's decision has three gates followed by the sweep:
 *   1. blink phase clear     -> do nothing this frame
 *   2. spawn-phase toggle at its gate value -> spawning is suspended, do nothing
 *   3. spawn-cadence countdown still running -> just tick it down one, spawn no one yet
 * Only when all three gates pass does it scan the pool: an already-live record is skipped and the
 * scan continues; the first empty record is spawned into and the scan stops for the frame.
 *
 * LIVE-OUT: none. No register value is meant to survive. The effects live in memory: each spawn
 * (performed by the per-record body spawnEnemyIntoFreeSlotCyclingAnim) seeds one enemy record and re-arms the cadence
 * countdown, and a still-running countdown is decremented here.
 */
export function spawnEnemyOnBlinkCountdownSweep(m) {
  const { mem8 } = m;

  // Gate 1 — the blink phase (0x892b). This byte flags whether the enemy-arrival subsystem is
  // currently in its active half. When it is clear the whole driver stands down and no spawn or
  // countdown work happens this frame.
  if (mem8[BLINK_PHASE] === 0) return;

  // Gate 2 — the spawn-phase toggle (0x892c). This is the same rotating counter each spawn advances
  // to cycle enemies through their entrance animations; when it has climbed to TOGGLE_GATE (0x06)
  // the driver treats spawning as suspended and returns without touching the countdown or the pool.
  if (mem8[ANIM_PHASE_TOGGLE_892C] === TOGGLE_GATE) return;

  // Gate 3 — the spawn-cadence countdown (0x892a). This is the throttle: it is loaded with a delay
  // every time an enemy is born, and must run down to zero before the next enemy may appear. While
  // it is still non-zero the only thing this frame does is tick it down by one, then bail out — no
  // slot is scanned and no enemy is spawned until it expires.
  if (mem8[BLINK_COUNTDOWN] !== 0) {
    mem8[BLINK_COUNTDOWN] = mem8[BLINK_COUNTDOWN] - 1; // still counting down toward the next spawn
    return;
  }

  // All gates passed and the cadence has expired: scan the enemy pool for a home for one new enemy.
  // Walk from the base of ENEMY_ACTOR_TABLE (0x8ae0), one record every RECORD_STRIDE (0x18) bytes,
  // for up to RECORD_COUNT (18) records. Each record is handed to the per-record spawn body
  // spawnEnemyIntoFreeSlotCyclingAnim, which reports back whether it left the slot alone or claimed it:
  //   - true  -> that slot was already live; nothing spawned, keep scanning the next record.
  //   - false -> that slot was empty and has now been spawned into; it also re-armed the cadence
  //              countdown (0x892a). We abort the whole sweep so exactly ONE enemy is born per
  //              eligible frame, leaving any further empty slots for future frames.
  let rec = ENEMY_ACTOR_TABLE;
  for (let n = 0; n < RECORD_COUNT; n++) {
    if (!spawnEnemyIntoFreeSlotCyclingAnim(m, rec)) return; // spawned into this record -> abort the sweep for this frame
    rec = u16(rec + RECORD_STRIDE); // advance to the next record (wrap kept in 16-bit RAM space)
  }
}
