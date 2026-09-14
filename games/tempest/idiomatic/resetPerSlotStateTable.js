// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS, SPAWN_BUDGET_TIMER, SPAWN_FOUND_FLAG, MODE_DISPATCH_SEL, PROJ_OFS_X_LO, PROJ_OFS_X_HI } from "./names.js";

/**
 * resetPerSlotStateTable — slot-arm init leaf. ROM 0xa789.
 *
 * Role in the machine: when the game arms a newly requested sound/enemy slot (called from
 * armRequestedSoundSlot), it must wipe the sixteen-byte per-slot state/flags table and reset the few
 * scalar cells that drive spawning and mode dispatch to their fresh starting values, so the slot
 * begins from a clean, known state rather than inheriting the previous occupant's flags.
 *
 * Behavior: it clears the sixteen-byte per-slot flags table ENEMY_SLOT_FLAGS ($283..$292) top-down,
 * then re-seeds five scalars — SPAWN_BUDGET_TIMER ($10e)=0x20 and SPAWN_FOUND_FLAG ($10d)=0x20 (the
 * spawn budget/found pair), MODE_DISPATCH_SEL ($1)=0x04 (mode selector), and the projection X offset
 * pair PROJ_OFS_X_LO/PROJ_OFS_X_HI ($68/$69) cleared to 0.
 *
 * Live-out: ENEMY_SLOT_FLAGS[0..0x0f] all zero, SPAWN_BUDGET_TIMER=0x20, SPAWN_FOUND_FLAG=0x20,
 * MODE_DISPATCH_SEL=0x04, PROJ_OFS_X_LO=PROJ_OFS_X_HI=0. Grounding: [seen].
 */
export function resetPerSlotStateTable(m) {
  const { mem8 } = m;
  // Wipe the 16-byte per-slot state/flags table.
  for (let x = 0x0f; x >= 0; x--) mem8[u16(ENEMY_SLOT_FLAGS + x)] = 0x00;
  // Re-seed the spawn budget/found pair and the mode selector to their start values.
  mem8[SPAWN_BUDGET_TIMER] = 0x20;
  mem8[SPAWN_FOUND_FLAG] = 0x20;
  mem8[MODE_DISPATCH_SEL] = 0x04;
  // Clear the projection X offset (lo/hi).
  mem8[PROJ_OFS_X_LO] = 0x00;
  mem8[PROJ_OFS_X_HI] = 0x00;
}
