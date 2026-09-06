// SPDX-License-Identifier: GPL-3.0-only
// Shared free-slot finder. Scan the four descriptor slots from the last downward for a free one (both
// guard bytes zero); on a hit, seed the slot and enqueue its spawn word. No free slot -> nothing. The
// trigger pointer and spawn code arrive from the caller and pass straight through to the seeder.
import { DESCRIPTOR_SLOT_TABLE } from "./names.js";
import { activateObjectSlotAndEnqueueSpawn } from "./activateObjectSlotAndEnqueueSpawn.js";

const SLOT_COUNT = 4;   // descriptor slots scanned
const SLOT_STRIDE = 32; // bytes per slot; the scan walks high -> low

export function loc_1446(m, trigger = m.regs.hl, spawnCode = m.regs.c) {
  const { mem8 } = m;
  let slot = DESCRIPTOR_SLOT_TABLE + (SLOT_COUNT - 1) * SLOT_STRIDE;
  for (let i = 0; i < SLOT_COUNT; i++, slot -= SLOT_STRIDE) {
    if ((mem8[slot] | mem8[slot + 1]) === 0) {
      return activateObjectSlotAndEnqueueSpawn(m, trigger, slot, spawnCode);
    }
  }
  // no free slot
}
