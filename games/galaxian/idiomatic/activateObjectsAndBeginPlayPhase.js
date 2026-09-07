// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateObjectsAndBeginPlayPhase — the state-timer handler that turns the object/AI subsystem on and
 * enters the play phase once its dwell timer runs out.
 *
 * WHAT IT IS
 *   A dwell-timer handler dispatched by SEQUENCE_STATE. Each frame it ticks timer 0x4009 and, while it
 *   is still counting, does nothing else. On the frame the timer expires it reloads it, advances the
 *   sequence, enables the object subsystem, seeds the ship's reference X, refills the enemy-launch
 *   sub-counter block, clears two scratch cells, and queues two display command words.
 *
 * ROLE IN THE MACHINE
 *   Setting OBJ_ACTIVE_FLAG (0x4200) bit 0 is the master switch that lets the object-AI, projectile,
 *   pacing/launch, and collision code run — before this fires, the play field is inert. The 16-bit
 *   write here seeds the whole flag pair (0x4200 = 1, 0x4201 = 0). loc_4202 (0x4202) is the ship's X
 *   reference, parked at 128 (screen centre) as play begins. The 16-byte enemy-launch sub-counter
 *   block at loc_424a (0x424a) is the per-attacker pacing counters, refilled here from
 *   SUBCOUNTER_RELOAD_TABLE (0x15e3); paceEnemyLaunchTrigger later meters divers out of it. The two
 *   command words are channel-7 (arg 3) and channel-2 (arg 0, the 4x4 indicator draw).
 *
 * ROM 0x0614.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: the second enqueueCommandWord's result; timer 0x4009, SEQUENCE_STATE, the 0x4200 flag
 * pair, 0x4202, the 16-byte block at 0x424a, scratch 0x4058/0x405a, and the command queue are written.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4009,
  SEQUENCE_STATE,
  OBJ_ACTIVE_FLAG,
  loc_4202,
  SUBCOUNTER_RELOAD_TABLE,
  loc_424a,
  loc_4058,
  loc_405a,
} from "./names.js";

// The dwell timer reloads to 10 frames; the sub-counter block is 16 bytes wide.
const TIMER_RELOAD = 10;
const SUBCOUNTER_BYTES = 16;

export function activateObjectsAndBeginPlayPhase(m) {
  const { mem8, mem16 } = m;

  // Tick the dwell timer 0x4009. While it is still counting down, hold this state — the play phase has
  // not started yet.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return; // still counting down

  // Timer expired: reload it and advance SEQUENCE_STATE to the next sub-state.
  mem8[loc_4009] = TIMER_RELOAD;
  mem8[SEQUENCE_STATE]++;

  // Enable the object subsystem: the 16-bit write sets OBJ_ACTIVE_FLAG (0x4200) bit 0 (the master
  // switch for object-AI / projectiles / launch / collisions) and clears the paired 0x4201 byte. Then
  // park the ship's reference X (0x4202) at 128 = screen centre.
  mem16[OBJ_ACTIVE_FLAG] = 1;
  mem8[loc_4202] = 128;

  // Refill the 16-byte enemy-launch sub-counter block (0x424a) from SUBCOUNTER_RELOAD_TABLE (0x15e3),
  // so the diver-pacing counters start fresh, then clear the 0x4058/0x405a scratch cells.
  for (let i = 0; i < SUBCOUNTER_BYTES; i++) mem8[loc_424a + i] = mem8[SUBCOUNTER_RELOAD_TABLE + i];
  mem8[loc_4058] = 0;
  mem8[loc_405a] = 0;

  // Queue the two display commands: channel-7 (arg 3), then channel-2 (arg 0, the 4x4 indicator draw).
  enqueueCommandWord(m, (7 << 8) | 3);
  return enqueueCommandWord(m, 2 << 8);
}
