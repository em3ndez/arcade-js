// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { launchProjectileIfRecordInFireWindow } from "./launchProjectileIfRecordInFireWindow.js";
import {
  LANE_SPAWN_COUNTDOWN,
  ACTIVE_LANE_COUNT,
  loc_8d77,
  ROUND_COUNTER,
  ENEMY_ACTOR_TABLE,
  LAUNCH_ARM_LATCH,
} from "./names.js";
/**
 * fireArmedEnemyProjectilesAndDisarm — end-of-wave enemy-fire volley and wave teardown.
 *
 * WHAT IT IS
 *   The final cleanup pass of the per-frame actor update. Once an attack wave has finished
 *   spawning its lane of enemies, this routine fires off any shots those enemies still have armed
 *   and then tears the wave's launch bookkeeping down so the next wave can be armed. It is a
 *   two-part act: a guarded "should we act at all?" test, then a six-record fire volley followed
 *   by a latch reset.
 *
 * ROLE IN THE MACHINE
 *   Enemies in Pooyan live as fixed 0x18-byte records in the actor arena; the six enemy records
 *   sit back-to-back at ENEMY_ACTOR_TABLE (0x8ae0), stride 0x18. During a wave the lane-spawn
 *   sequence releases them one at a time, and while that sequence runs enemy fire is suppressed.
 *   This pass is what closes the wave out: after the lane sequence has drained it walks all six
 *   enemy records past the per-record fire gate — giving each armed, in-window enemy its parting
 *   shot — and then clears the two latches that mark a wave as live, freeing the launch machinery
 *   to re-arm for the next wave.
 *
 * ROM ADDRESS: 0x5b2c-0x5b70.
 * GROUNDING: [seen].
 *
 * GATING (all of these must line up before anything happens)
 *   LANE_SPAWN_COUNTDOWN (0x8d75)  the wave's spawn pacer / fire-suppression latch. Zero means no
 *                                  wave is live, so there is nothing to clean up.
 *   ACTIVE_LANE_COUNT (0x8d79)     count of lane actors still being activated. Nonzero means the
 *                                  lane sequence is still running, so the teardown must wait.
 *   loc_8d77                       a pending / wave-end flag. When already set, the routine goes
 *                                  straight to the volley; when clear, it must first find the
 *                                  wave-end key in an enemy record before it will act.
 *
 * LIVE-OUT (memory only — nothing is handed back in registers)
 *   LANE_SPAWN_COUNTDOWN (0x8d75) and the launch-arm latch LAUNCH_ARM_LATCH (0x8f20) are both
 *   cleared to 0, closing the wave out and releasing the launch state machine to re-arm. Along the
 *   way, each enemy that clears the fire gate spawns a projectile into the shot pool
 *   PROJECTILE_TABLE (0x8be8) and bumps the shot spawn counter (0x8d42).
 */

// Layout of the enemy-record scan and sweep. The six enemy records are packed back-to-back in the
// actor arena from ENEMY_ACTOR_TABLE, each 0x18 bytes wide. The wave-end scan reads one byte per
// record (record+0x04, the wave-end key), and the fire sweep visits each record's base in turn.
const STRIDE = 0x18; //         enemy-record pitch
const RECORD_COUNT = 0x06; //   records scanned/swept
const KEY_FIELD = 0x04; //      record+4 holds the wave-end key
const KEY_EVEN = 0x13; //       wave-end key on an even round (round-counter bit0 clear)
const KEY_ODD = 0x0b; //        wave-end key on an odd round

export function fireArmedEnemyProjectilesAndDisarm(m) {
  const { mem8 } = m;

  // Guard A — is a wave even live? LANE_SPAWN_COUNTDOWN (0x8d75) is the spawn pacer that counts
  // down while a lane-spawn sequence runs and, being nonzero, suppresses enemy fire. If it has
  // already reached zero there is no wave to close out, so leave at once.
  if (mem8[LANE_SPAWN_COUNTDOWN] === 0) return; // latch clear -> nothing to clean

  // Guard B — has the lane finished releasing its enemies? ACTIVE_LANE_COUNT (0x8d79) tracks the
  // lane actors still being activated; while it is nonzero the wave is mid-release. Tearing down
  // now would cut the wave short, so return and let a later frame handle it.
  if (mem8[ACTIVE_LANE_COUNT] !== 0) return; // lane sequence still running -> wait

  // Wave-end detection. When the pending flag loc_8d77 is already set, the wave is known to be
  // ending and this scan is skipped entirely (falling through to the volley). Otherwise, confirm
  // the wave has truly reached its end by hunting for the wave-end key in the enemy records. The
  // key depends on round parity — ROUND_COUNTER (0x8907) bit0: 0x0b on an odd round, 0x13 on an
  // even one — and is looked for in each record's +0x04 field, walking all six records at stride
  // 0x18. If no record carries the key, the wave is not over yet, so return without firing.
  if (mem8[loc_8d77] === 0) {
    const key = mem8[ROUND_COUNTER] & 0x01 ? KEY_ODD : KEY_EVEN;
    let scan = ENEMY_ACTOR_TABLE + KEY_FIELD;
    let hit = false;
    for (let i = 0; i < RECORD_COUNT; i++) {
      if (mem8[scan] === key) { hit = true; break; }
      scan = u16(scan + STRIDE);
    }
    if (!hit) return; // scanned all six, no wave-end key
  }

  // The fire volley. The wave is ending, so give every enemy one last chance to shoot: walk all
  // six enemy records from ENEMY_ACTOR_TABLE (0x8ae0) at stride 0x18 and hand each to the
  // per-record fire gate. The gate releases a projectile only for a record that is in its fire
  // state, has its fire-armed bit set, and is still inside its launch window; any other record is
  // left untouched.
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    launchProjectileIfRecordInFireWindow(m, rec); // fire gate for this record
    rec = u16(rec + STRIDE);
  }
  // Wave teardown. With the volley fired, clear the two latches that mark the wave as live:
  // LANE_SPAWN_COUNTDOWN (0x8d75), whose clear also lifts the fire suppression, and the launch-arm
  // latch LAUNCH_ARM_LATCH (0x8f20), whose clear frees the launch state machine to arm the next
  // wave.
  mem8[LANE_SPAWN_COUNTDOWN] = 0x00;
  mem8[LAUNCH_ARM_LATCH] = 0x00;
}
