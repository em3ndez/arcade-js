// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnBoardObject — on the spawn cadence, claim a free object slot and seed a new
 * board object; always tick the cadence timer down.
 *
 * Called once per pass from the board-object service, which animates the objects already
 * live and then calls here to top them up. It is a periodic allocator gated by a single
 * cooldown byte, SPAWN_TIMER, and it takes one of three paths:
 *
 *   - OFF-BEAT (timer still running): while SPAWN_TIMER is nonzero nothing spawns — the
 *     timer is simply ticked down one and the routine returns.
 *
 *   - ON-BEAT, a slot is free: with the timer at zero, scan the six records of the
 *     board-object array for the first whose active flag's low bit is clear. Claim it —
 *     mark it active and stamp the new object's spawn position and initial state — then
 *     reload the cooldown and tick it once, so it lands at reload-minus-one and the next
 *     spawn is one beat sooner than a full reload.
 *
 *   - ON-BEAT, every slot busy: give up this pass WITHOUT reloading or ticking the timer,
 *     so it stays at zero and retries every following pass until a slot frees.
 *
 * NOT CLAIMED: what kind of object this spawns. The seed bytes are a fixed bottom-of-screen
 * position and an initial-state flag, stamped verbatim. The mechanism — a cadence-gated
 * first-free-slot allocator over the board-object array — is what the name claims.
 *
 * LIVE-OUT: memory-only — SPAWN_TIMER, plus the claimed record's active flag, X, Y and state
 * byte on the spawning path.
 */

import { SPAWN_TIMER, OBJ_ARRAY_66, OBJ_ACTIVE, OBJ_X, OBJ_Y, OBJ_STATE } from "./names.js";
import { decrementByteAt } from "./decrementByteAt.js";

const SLOT_COUNT = 6;         // OBJ_ARRAY_66 holds six object records
const SLOT_STRIDE = 0x10;     // record stride of OBJ_ARRAY_66
const ACTIVE_BIT = 0x01;      // bit0 of the active flag: 1 = slot in use

const SPAWN_X = 0x37;         // seeded X position of the new object
const SPAWN_Y = 0xf8;         // seeded Y position (near the bottom of the screen)
const SPAWN_STATE = 0x08;     // seeded OBJ_STATE value: bit 3 set, which the travel update reads
const COOLDOWN_RELOAD = 0x34; // cadence timer reload applied after a spawn

/**
 * @param {object} m  the machine (uses m.mem; direct-calls decrementByteAt).
 * @returns {void}
 */
export function spawnBoardObject(m) {
  const { mem } = m;

  // Off-beat: while the cadence timer is still running, just tick it down and stop.
  if (mem.read8(SPAWN_TIMER) !== 0) {
    decrementByteAt(m, SPAWN_TIMER);
    return;
  }

  // On the beat: find the first free record (active bit clear). Records are one stride
  // apart from the array base.
  let slot = OBJ_ARRAY_66;
  let free = false;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if ((mem.read8(slot + OBJ_ACTIVE) & ACTIVE_BIT) === 0) { free = true; break; }
    slot += SLOT_STRIDE;
  }

  // Every slot busy: give up this pass WITHOUT reloading or ticking the timer, so it
  // stays at zero and retries next pass.
  if (!free) return;

  // Claim the free slot: mark it active and stamp the spawn position and initial state.
  mem.write8(slot + OBJ_ACTIVE, ACTIVE_BIT);
  mem.write8(slot + OBJ_X, SPAWN_X);
  mem.write8(slot + OBJ_Y, SPAWN_Y);
  mem.write8(slot + OBJ_STATE, SPAWN_STATE);

  // Reload the cadence timer, then tick it once (the shared decrement tail runs on this
  // path too), so it lands at reload-minus-one.
  mem.write8(SPAWN_TIMER, COOLDOWN_RELOAD);
  decrementByteAt(m, SPAWN_TIMER);
}
