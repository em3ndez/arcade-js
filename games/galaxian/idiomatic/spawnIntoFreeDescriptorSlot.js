// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnIntoFreeDescriptorSlot — the shared "find a free descriptor slot and spawn into it" helper.
 *
 * WHAT IT IS
 *   Scans the four 32-byte descriptor slots at DESCRIPTOR_SLOT_TABLE (0x4330) — the extra object
 *   records that sit past the primary object table — looking for one that is idle, and hands the first
 *   free one to the slot-seeder. A slot is FREE when both of its two leading guard bytes are zero;
 *   activateObjectSlotAndEnqueueSpawn stamps those bytes when it claims a slot, so a zeroed pair means
 *   no live object owns it. If every slot is busy the routine does nothing.
 *
 * ROLE IN THE MACHINE
 *   The common tail of the delayed-event and trigger-flag spawn paths (spawnObjectsOnDelayedEvent
 *   0x140c and spawnObjectsFromTriggerFlags 0x14be call it — see mechanisms.md "Spawning secondary
 *   objects and delayed events"). It does not decide WHAT to spawn: the caller passes the trigger-flag
 *   pointer it matched on and the spawn code, and both pass straight through to
 *   activateObjectSlotAndEnqueueSpawn (0x145c), which consumes the trigger flag, marks the slot active,
 *   records the spawn code and source index, and enqueues the object's spawn command word.
 *
 * ROM 0x1446.  Grounding: [seen] (DESCRIPTOR_SLOT_TABLE is [seen]).
 *
 * LIVE-OUT: on a hit, whatever activateObjectSlotAndEnqueueSpawn writes (the seeded slot + the enqueued
 * spawn word), and its return value (the trigger pointer, unchanged) is returned through. No free slot:
 * nothing written, undefined returned. The scan takes m.regs.hl (trigger) and m.regs.c (spawn code).
 */
import { DESCRIPTOR_SLOT_TABLE } from "./names.js";
import { activateObjectSlotAndEnqueueSpawn } from "./activateObjectSlotAndEnqueueSpawn.js";

const SLOT_COUNT = 4;   // descriptor slots scanned
const SLOT_STRIDE = 32; // bytes per slot; the scan walks high -> low

export function spawnIntoFreeDescriptorSlot(m, trigger = m.regs.hl, spawnCode = m.regs.c) {
  const { mem8 } = m;
  // Start at the LAST slot and walk toward the first (the ROM scan runs high -> low). Each step drops
  // the pointer one 32-byte stride.
  let slot = DESCRIPTOR_SLOT_TABLE + (SLOT_COUNT - 1) * SLOT_STRIDE;
  for (let i = 0; i < SLOT_COUNT; i++, slot -= SLOT_STRIDE) {
    // Free test: OR the two guard bytes; zero means neither is set, so the slot is idle. Seed it and
    // return immediately — the first free slot wins.
    if ((mem8[slot] | mem8[slot + 1]) === 0) {
      return activateObjectSlotAndEnqueueSpawn(m, trigger, slot, spawnCode);
    }
  }
  // no free slot
}
