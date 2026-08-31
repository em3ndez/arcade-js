// SPDX-License-Identifier: GPL-3.0-only
import { launchProjectileIntoFreeSlot } from "./launchProjectileIntoFreeSlot.js";
/**
 * launchProjectileIfRecordInFireWindow — the per-record FIRE GATE for one enemy actor.
 *
 * WHAT IT IS
 *   Every enemy on the playfield lives as a fixed-size 0x18-byte record in the actor arena. This is
 *   the small decision that answers one question about one such record: should THIS enemy throw its
 *   projectile on this frame? It touches no other actor and moves nothing itself — it only screens
 *   the record against three conditions and, when all three hold, hands the record on to the code
 *   that actually spawns the shot.
 *
 * ROLE IN THE MACHINE
 *   The end-of-wave cleanup pass fireArmedEnemyProjectilesAndDisarm sweeps the six enemy records one
 *   at a time and calls this gate on each. So this routine is the "one record" step of a six-record
 *   fire volley: the caller loops, this decides per enemy whether the loop's current record fires.
 *   The record it looks at is the actor record the CPU's IX index register points at (offsets below
 *   are read straight off that base, exactly as every arena sweep addresses its records).
 *
 * ROM ADDRESS: 0x5b71-0x5b85.
 * GROUNDING: [seen].
 *
 * THE RECORD FIELDS IT READS (all relative to the record base)
 *   +0x02  state index — the enemy's position in its own state machine. It must be sitting in the
 *          dedicated "fire" state (FIRE_MODE, 0x05) or nothing happens.
 *   +0x07  facing / animation-variant flags. Bit 2 (FIRE_FLAG) is the per-record "fire armed" latch;
 *          it must be set for the enemy to be allowed to shoot.
 *   +0x06  a per-record countdown timer. The shot is only allowed while this is still inside the
 *          launch window — strictly below TIMER_LIMIT (0x11); once it has aged past that, too late.
 *
 * LIVE-OUT: memory only. When all guards pass it delegates to launchProjectileIntoFreeSlot, which
 *   bumps the spawn counter SPAWN_COUNTER (0x8d42) and writes a fresh shot into the first empty
 *   slot of the projectile pool PROJECTILE_TABLE (0x8be8). The sweep that calls this reads no
 *   register back — the whole result is those memory writes (or, on any guard failing, nothing).
 */

const FIRE_MODE = 0x05;   // rec+0x02 (state index) must equal this — the enemy is in its "fire" state
const FIRE_FLAG = 0x04;   // bit 2 of rec+0x07 (facing / animation-variant flags): the "fire armed" latch
const TIMER_LIMIT = 0x11; // rec+0x06 (countdown) must be strictly below this to be inside the launch window

export function launchProjectileIfRecordInFireWindow(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Guard 1 — right state. Read the record's state index at +0x02 and demand it be the fire state.
  // An enemy that is walking, turning, dying, or otherwise not in state 5 has no business throwing,
  // so any other value bails out immediately and leaves the record untouched.
  if (mem8[rec + 0x02] !== FIRE_MODE) return; // not mode 5

  // Guard 2 — actually armed. Even in the fire state a record only shoots when its fire-armed latch
  // is set: bit 2 of the facing / animation-variant byte at +0x07. If that bit is clear this enemy
  // is disarmed for this pass, so return without firing.
  if ((mem8[rec + 0x07] & FIRE_FLAG) === 0) return; // fire flag clear

  // Guard 3 — inside the launch window. The per-record countdown at +0x06 opens a brief window in
  // which the throw is permitted; the shot is only released while the timer is still below 0x11.
  // Once the timer has run past the window the moment has closed, so return without firing.
  if (mem8[rec + 0x06] >= TIMER_LIMIT) return; // timer past the launch window

  // All three guards hold: this enemy is in the fire state, armed, and inside its window — so it
  // throws now. Hand the record to the launcher, which finds a free projectile slot, stamps the new
  // shot into it, and advances the spawn counter.
  launchProjectileIntoFreeSlot(m, rec); // all guards pass — launch this record's projectile
}
