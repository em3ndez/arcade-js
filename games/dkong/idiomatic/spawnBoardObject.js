// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnBoardObject — on the spawn cadence, claim a free object slot and seed a new
 * board object; always tick the cadence timer down.  ROM 0x27DA.
 *
 * Called once per pass from the board-object service (ROM 0x2722, which animates the
 * existing objects then calls here to top them up). It is a periodic allocator gated by
 * a single cooldown byte, SPAWN_TIMER, and it takes one of three paths:
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
 * The concrete kind of object spawned is not grounded here — the seed bytes (a bottom-of-
 * screen position and an initial-state flag) are copied verbatim from the ROM. The
 * mechanism, a cadence-gated first-free-slot allocator for the board-object array, is
 * certain; that is what the name claims.
 *
 * Memory-equivalent to the frozen oracle — equivalence-27da.test.js.
 * GATE:     crafted + exhaustive. The spawn cascade under ROM 0x2722 is never reached in
 *           attract, so there are no natural dispatches to capture. Validated instead by
 *           an EXHAUSTIVE sweep of a slot's active byte over all 256 values (the free-test
 *           decision), an EXHAUSTIVE sweep of the timer over all 256 values (the off-beat
 *           tick vs the no-free-slot no-op), and CRAFTED entries that seed each of the six
 *           slot positions in turn, the all-busy give-up, a free slot carrying stray high
 *           bits, and two free slots (first wins). The caller's stride live-in (`de` = the
 *           array stride 0x10) is pinned on the oracle side to match. Teeth: a wrong
 *           reload value, an inverted free-test, and a dropped seed field.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its single terminal
 *           stack pop (the shared decrement tail at ROM 0x2806, or the no-slot `ret`) are
 *           dead — the caller resumes its own work and reloads its registers without
 *           reading them. The oracle only POPS the stack (never pushes), so no stack byte
 *           is written differently; the gate compares the whole RAM dump and needs no
 *           stack-scratch exclusion.
 * NAMES:    SPAWN_TIMER (0x62A7), OBJ_ARRAY_66 (0x6600), OBJ_ACTIVE (+0), OBJ_X (+3),
 *           OBJ_Y (+5), OBJ_STATE (+0x0D) from ram.js; decrementByteAt (ROM 0x2806)
 *           direct-called with the timer address. The four seed bytes (X, Y, initial
 *           OBJ_STATE value, timer reload) are raw ROM data and stay local hex consts.
 */

import { SPAWN_TIMER, OBJ_ARRAY_66, OBJ_ACTIVE, OBJ_X, OBJ_Y, OBJ_STATE } from "./ram.js";
import { decrementByteAt } from "./decrementByteAt.js"; // ROM 0x2806

const SLOT_COUNT = 6;         // OBJ_ARRAY_66 holds six object records
const SLOT_STRIDE = 0x10;     // record stride of OBJ_ARRAY_66 (the caller's `de` live-in)
const ACTIVE_BIT = 0x01;      // bit0 of the active flag: 1 = slot in use

const SPAWN_X = 0x37;         // seeded X position of the new object
const SPAWN_Y = 0xf8;         // seeded Y position (near the bottom of the screen)
const SPAWN_STATE = 0x08;     // seeded OBJ_STATE (+0x0D) value: bit3 set (advanceBoardObjectTravel reads bit3)
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
