// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnObjectsFromTriggerFlags — the "full trigger-block spawn" branch of the delayed-event path.
 *
 * WHAT IT IS
 *   Reads the two trigger-flag blocks and turns set flags into freshly launched objects. It has two
 *   mutually exclusive outcomes: (a) if any PRIMARY_TRIGGER_BLOCK (0x4176) flag is set, the first set
 *   one spawns a primary object into the object table AND then up to two secondary objects are spawned
 *   for the set flags that follow it in the secondary block; (b) if no primary flag is set, the first
 *   set SECONDARY_TRIGGER_BLOCK (0x4165) flag instead seeds a free descriptor slot. No set flag
 *   anywhere means nothing spawns.
 *
 * ROLE IN THE MACHINE
 *   Invoked by spawnObjectsOnDelayedEvent (0x140c) when the launch direction routes the "full block"
 *   spawn (see mechanisms.md "Spawning secondary objects and delayed events"). The trigger blocks are
 *   the per-column request flags the pacing/scheduling code raises; this routine drains them into
 *   objects. OBJ_TABLE (0x42d0) is the primary object table (the second slot of the shared record
 *   array); secondaries fill from OBJ_TABLE + one 32-byte stride onward. activateObjectSlotAndEnqueueSpawn
 *   (0x145c) claims and seeds the primary; spawnSecondaryObjectIntoSlot (0x149b) does the secondaries;
 *   spawnIntoFreeDescriptorSlot (0x1446) handles the descriptor-slot fallback. The passed spawnCode
 *   (m.regs.c) is the object type recorded on each spawn.
 *
 *   The secondary flags are read at SECONDARY_TRIGGER_BLOCK + hit + j — i.e. the primary hit index is
 *   reused as the offset into the secondary block, so the secondaries a primary launches are the same
 *   column position in the sibling block.
 *
 * ROM 0x14be.  Grounding: [seen]. Cells: OBJ_TABLE, PRIMARY_TRIGGER_BLOCK, SECONDARY_TRIGGER_BLOCK.
 *
 * LIVE-OUT: newly activated object/descriptor slots and their enqueued spawn words. No register contract.
 */
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

  // Scan the four primary flags low -> high for the first set one; remember its index in `hit`.
  let hit = -1;
  for (let i = 0; i < PRIMARY_SCAN; i++) {
    if (mem8[PRIMARY_TRIGGER_BLOCK + i] & 1) { hit = i; break; }
  }

  // No primary flag set: fall back to the secondary block. The first set secondary flag seeds a free
  // descriptor slot (not an object-table slot) and we are done.
  if (hit < 0) {
    for (let i = 0; i < SECONDARY_SCAN; i++) {
      if (mem8[SECONDARY_TRIGGER_BLOCK + i] & 1) {
        return spawnIntoFreeDescriptorSlot(m, SECONDARY_TRIGGER_BLOCK + i, spawnCode);
      }
    }
    return;
  }

  // A primary flag was set: spawn the primary object into the object table. The trigger pointer it was
  // found under is consumed (cleared) inside activateObjectSlotAndEnqueueSpawn.
  activateObjectSlotAndEnqueueSpawn(m, PRIMARY_TRIGGER_BLOCK + hit, OBJ_TABLE, spawnCode);

  // Then walk up to three secondary flags at the SAME column offset as the primary hit, spawning a
  // secondary object into successive slots (starting one stride past the primary) for each set flag,
  // capped at two secondaries per primary spawn.
  let slot = SECONDARY_SLOT_BASE;
  let spawned = 0;
  for (let j = 0; j < SECONDARY_WALK; j++) {
    if (mem8[SECONDARY_TRIGGER_BLOCK + hit + j] & 1) {
      spawnSecondaryObjectIntoSlot(m, slot, OBJ_TABLE, SECONDARY_TRIGGER_BLOCK + hit + j);
      // Advance to the next 32-byte slot (wrapped to 16 bits) and stop once the budget of two is spent.
      slot = u16(slot + SLOT_STRIDE);
      if (++spawned === SECONDARY_BUDGET) break;
    }
  }
}
