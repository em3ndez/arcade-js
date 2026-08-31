// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickActorAnimHold } from "./tickActorAnimHold.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * tickEnemyActorAnimHolds — advance the per-frame animation clock of every enemy actor.
 *
 * ROM 0x5d0b. Grounding: [seen].
 *
 * WHAT IT IS
 *   A fixed-count sweep of the enemy actor table. ENEMY_ACTOR_TABLE (0x8ae0) is a pool of
 *   uniform, 0x18-byte object records — one per on-rope enemy slot. Six of those records make
 *   up the enemy animation set this routine services. Every frame the machine calls here once,
 *   and the routine walks those six records in order, handing each in turn to tickActorAnimHold
 *   so that record's small animation clock (a hold timer + a short phase counter buried inside
 *   the record) is stepped one tick.
 *
 * ROLE IN THE MACHINE
 *   This is the animation heartbeat for the enemy sprites. tickActorAnimHold does the real work
 *   per record — counting a dwell timer down, and when it lapses stepping the actor to the next
 *   cell of its short sprite cycle — but only ever for the one record it is handed. This routine
 *   is the driver that guarantees all six slots get that tick each frame, at the fixed stride at
 *   which the records are laid out in memory.
 *
 * LIVE-OUT: memory-only. Each visited record is mutated in place (its hold/phase fields inside
 *   the record); nothing is returned and no shared state outside the records is touched.
 */

// The enemy animation set is six records long, and the records are packed back-to-back at a
// fixed 0x18 (24) byte stride — the uniform record size the whole 0x8ae0 object pool uses.
const RECORD_COUNT = 6;
const RECORD_STRIDE = 0x18;

export function tickEnemyActorAnimHolds(m) {
  // Start the cursor at the base of the enemy actor table (0x8ae0), the first of the six
  // records to service this frame.
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Tick this one record's animation clock: count its hold timer down and, on lapse, step
    // its sprite-cell phase. All of the per-record enable gating lives inside tickActorAnimHold,
    // so a still, dormant, or off-screen slot passed here simply costs nothing.
    tickActorAnimHold(m, rec);
    // Step the cursor forward one record — up 0x18 bytes to the next slot — and keep it a
    // 16-bit address so it wraps at the top of memory like the machine's own pointer arithmetic.
    rec = u16(rec + RECORD_STRIDE);
  }
}
