// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2f, SAVED_INDEX, OBJECT_INDEX_TABLE, OBJECT_RECORD_TABLE, FIRE_GATE } from "./names.js";
import { placeSpawnListForColumnDeficit } from "./placeSpawnListForColumnDeficit.js";
import { spawnClimberInFreeSlot } from "./spawnClimberInFreeSlot.js";

/**
 * spawnEnemyOnTimerExpiry — turn one expired slot timer into a climber spawn. ROM 0x9923.
 *
 * Role in the machine: called by tickSpawnSlotTimers (0x98a2) whenever a per-slot spawn timer in the
 * 64-entry table reaches zero. It converts that expiry into an actual attempt to bring a new climber
 * onto the tube: it stages a spawn request, runs the column-deficit placement pass that decides where
 * on the rim the enemy belongs, and — if the request survives that pass and a free enemy slot exists —
 * commits the spawn and consumes a fire-gate credit; otherwise it marks the request failed and re-arms
 * this slot's timer to try again later.
 *
 * Behavior: it raises the spawn request by writing loc_29 = 0xf0 (the depth seed the allocator reads),
 * latches this slot's object-index OBJECT_INDEX_TABLE,x (loc_203) into loc_2a (the staged segment), and
 * saves X in SAVED_INDEX (0x35) because the placement pass clobbers registers. placeSpawnListForColumnDeficit
 * runs the rim placement, then X is reloaded from SAVED_INDEX. If the request is still live (loc_29 != 0)
 * and spawnClimberInFreeSlot finds a free slot (returns nonzero — note Y takes its own default scan index,
 * X passed explicitly and preserved), the spawn took: FIRE_GATE (loc_3ab) is decremented and the slot
 * timer OBJECT_RECORD_TABLE,x (loc_243) is cleared. Otherwise the placement failed: loc_2f is flagged 0xff
 * and the slot timer is bumped by one to re-arm it. Either way X is the live-out register.
 *
 * Live-out: X (the saved slot index) in m.regs.x; on success FIRE_GATE decremented and the slot timer
 * cleared; on failure loc_2f = 0xff and the slot timer re-armed. Grounding: [seen].
 */
export function spawnEnemyOnTimerExpiry(m, x = m.regs.x) {
  const { mem8 } = m;

  mem8[loc_29] = 0xf0;                              // raise the spawn request (depth seed)
  mem8[loc_2a] = mem8[u16(OBJECT_INDEX_TABLE + x)]; // stage this slot's segment
  mem8[SAVED_INDEX] = x;                            // save X across the placement pass

  placeSpawnListForColumnDeficit(m);

  // the placement pass may relocate the saved slot index; reload it before touching the slot's timer.
  x = mem8[SAVED_INDEX];

  // the survival check takes the free-slot scan index in Y (its own default); pass X explicitly, which it preserves.
  if (mem8[loc_29] !== 0 && spawnClimberInFreeSlot(m, undefined, x) !== 0) {
    mem8[FIRE_GATE] = mem8[FIRE_GATE] - 1;          // spend a fire-gate credit
    mem8[u16(OBJECT_RECORD_TABLE + x)] = 0x00;      // clear the slot timer (spawn done)
    return (m.regs.x = x);
  }

  mem8[loc_2f] = 0xff;                              // flag the placement failed
  mem8[u16(OBJECT_RECORD_TABLE + x)] = mem8[u16(OBJECT_RECORD_TABLE + x)] + 1; // re-arm the timer
  return (m.regs.x = x);
}
