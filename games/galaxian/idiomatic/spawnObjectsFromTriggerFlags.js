// SPDX-License-Identifier: GPL-3.0-only
// Scan the trigger-flag blocks and spawn. First scan the primary block (four flags): the first set flag
// spawns a primary object into the object table, then walks the secondary flags -- remapped to the
// secondary block at the same offset -- spawning a secondary object per set flag until a budget of two is
// spent. If no primary flag is set, scan the secondary block (four flags): the first set flag instead
// seeds a free descriptor slot.
import { u16 } from "../../../core/int.js";
import { spawnIntoFreeDescriptorSlot } from "./spawnIntoFreeDescriptorSlot.js";
import { activateObjectSlotAndEnqueueSpawn } from "./activateObjectSlotAndEnqueueSpawn.js";
import { spawnSecondaryObjectIntoSlot } from "./spawnSecondaryObjectIntoSlot.js";
import { OBJ_TABLE, PRIMARY_TRIGGER_BLOCK, SECONDARY_TRIGGER_BLOCK } from "./names.js";

const PRIMARY_SCAN = 4;
const SECONDARY_SCAN = 4;
const SECONDARY_WALK = 3;                            // secondary flags visited after a primary spawn
const SECONDARY_BUDGET = 2;                          // at most two secondaries per primary spawn
const SLOT_STRIDE = 32;
const SECONDARY_SLOT_BASE = OBJ_TABLE + SLOT_STRIDE; // secondaries fill from the table's second slot

export function spawnObjectsFromTriggerFlags(m, spawnCode = m.regs.c) {
  const { mem8 } = m;

  let hit = -1;
  for (let i = 0; i < PRIMARY_SCAN; i++) {
    if (mem8[PRIMARY_TRIGGER_BLOCK + i] & 1) { hit = i; break; }
  }

  if (hit < 0) {
    for (let i = 0; i < SECONDARY_SCAN; i++) {
      if (mem8[SECONDARY_TRIGGER_BLOCK + i] & 1) {
        return spawnIntoFreeDescriptorSlot(m, SECONDARY_TRIGGER_BLOCK + i, spawnCode);
      }
    }
    return;
  }

  activateObjectSlotAndEnqueueSpawn(m, PRIMARY_TRIGGER_BLOCK + hit, OBJ_TABLE, spawnCode);

  let slot = SECONDARY_SLOT_BASE;
  let spawned = 0;
  for (let j = 0; j < SECONDARY_WALK; j++) {
    if (mem8[SECONDARY_TRIGGER_BLOCK + hit + j] & 1) {
      spawnSecondaryObjectIntoSlot(m, slot, OBJ_TABLE, SECONDARY_TRIGGER_BLOCK + hit + j);
      slot = u16(slot + SLOT_STRIDE);
      if (++spawned === SECONDARY_BUDGET) break;
    }
  }
}
