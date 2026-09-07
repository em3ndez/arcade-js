// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateDescriptorSlot — initialise one 32-byte descriptor slot from the number held at (HL).
 *
 * WHAT IT IS
 *   Reads a descriptor number from the byte at the passed pointer, converts it to a zero-based slot
 *   index (number - 1), and stamps that slot's fixed initial fields, leaving the slot marked active.
 *
 * ROLE IN THE MACHINE
 *   The descriptor slots live in a four-record table at DESCRIPTOR_SLOT_TABLE (0x4330), stride 32 —
 *   these sit past the primary object array (OBJ_TABLE 0x42d0) and are seeded by the free-slot finders
 *   and by the sequence-state handler activateDescriptorSlotsThenAdvanceSequence (ROM 0x023f), which
 *   passes the descriptor number cell 0x4009. Within a record the render convention fixes the field
 *   roles: [0] is the primary active flag, [2] the object-AI state index, [5] the signed heading, [7]
 *   the slot's own index. This routine stamps the fixed init fields and deliberately leaves [3] (sprite
 *   X) and [6] (direction/spawn code) untouched, so a caller can preset those before activation.
 *
 * ROM 0x0341.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: the 32-byte slot at DESCRIPTOR_SLOT_TABLE + (number-1)*32 is stamped. No register result.
 */
import { DESCRIPTOR_SLOT_TABLE } from "./names.js";

// Each descriptor record is 32 bytes wide.
const SLOT_SIZE = 32;

export function activateDescriptorSlot(m, ptr = m.regs.hl) {
  const { mem8 } = m;

  // Descriptor numbers are 1-based; subtract one (byte-wrapped) to get the zero-based slot index and
  // compute the base address of that slot within the 32-byte-stride table.
  const index = (mem8[ptr] - 1) & 0xff; // descriptor number minus one
  const base = DESCRIPTOR_SLOT_TABLE + index * SLOT_SIZE;

  // Stamp the fixed init fields: mark the slot active, clear [1], seed the state/heading constants
  // (0x0d, 0x0c) the object-AI expects, and record the slot's own index in [7]. Fields [3] (sprite X)
  // and [6] (direction/spawn code) are intentionally left as the caller staged them.
  mem8[base] = 1; // [0] active flag
  mem8[base + 1] = 0;
  mem8[base + 2] = 13;
  mem8[base + 4] = 0;
  mem8[base + 5] = 12;
  mem8[base + 7] = index; // [7] slot index
}
