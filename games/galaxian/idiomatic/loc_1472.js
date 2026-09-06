// SPDX-License-Identifier: GPL-3.0-only
// Spawn a primary object into the object table, then walk a small block of trigger flags (backed up from
// the primary trigger's low byte) and, for each flag that is set, spawn a secondary object into the next
// free slot. The secondary budget caps how many spawn; once it runs out the walk ends after that pass.
import { u8, u16 } from "../../../core/int.js";
import { activateObjectSlotAndEnqueueSpawn } from "./activateObjectSlotAndEnqueueSpawn.js";
import { spawnSecondaryObjectIntoSlot } from "./spawnSecondaryObjectIntoSlot.js";
import { OBJ_TABLE } from "./names.js";

const SLOT_STRIDE = 32; // bytes per object record
const SECONDARY_SLOT_BASE = OBJ_TABLE + SLOT_STRIDE; // first secondary slot (deserves its own name)
const TRIGGER_BLOCK_BACKOFF = 15; // primary trigger low byte -> top of the trigger-flag block
const TRIGGER_WALK = 3; // flags examined
const SECONDARY_BUDGET = 2; // secondaries this pass may spawn

export function loc_1472(m, trigger = m.regs.hl, spawnCode = m.regs.c) {
  const { mem8 } = m;

  // Spawn the primary; the trigger pointer is returned unchanged.
  const primary = activateObjectSlotAndEnqueueSpawn(m, trigger, OBJ_TABLE, spawnCode);

  // The flag block shares the primary trigger's high byte; only the low byte walks (Z80 `dec l`).
  const base = u16(primary - u8(primary));
  let low = u8(primary - TRIGGER_BLOCK_BACKOFF);
  let slot = SECONDARY_SLOT_BASE;
  let budget = SECONDARY_BUDGET;
  let counter = TRIGGER_WALK;

  do {
    if (mem8[base + low] & 1) {
      spawnSecondaryObjectIntoSlot(m, slot, OBJ_TABLE, base + low);
      slot = u16(slot + SLOT_STRIDE);
      budget = u8(budget - 1);
      if (budget === 0) counter = 1; // budget spent -> this is the last pass
    }
    low = u8(low - 1);
    counter = u8(counter - 1);
  } while (counter !== 0);
}
