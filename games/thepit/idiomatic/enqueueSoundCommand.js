// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueSoundCommand — append one sound request to the sound ring buffer.
 * The shared tail of a fan of ~20 tiny sound-trigger stubs: each stub loads a distinct
 * sound-command index and falls into here. This marks that index pending (sets the high
 * bit) and drops it into the next free slot of the 8-slot sound ring, then advances the
 * write pointer to the following slot, wrapping to slot 0 after the eighth. The driver
 * drains the ring; the high bit tells a filled slot from an empty one. The index arrives
 * from the calling stub, a parameter defaulting to that register.
 */
import { SOUND_HEAD, SOUND_RING } from "./names.js";

export function enqueueSoundCommand(m, commandIndex = m.regs.a) {
  const { mem8 } = m;

  // Take the current write slot, then advance the pointer to the next of the 8 slots.
  const slot = mem8[SOUND_HEAD];
  mem8[SOUND_HEAD] = (slot + 1) % 8;

  // Fill that slot with the command, high bit set to mark the slot as pending.
  mem8[SOUND_RING + slot] = commandIndex | 0x80;
}
