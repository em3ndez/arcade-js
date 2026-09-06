// SPDX-License-Identifier: GPL-3.0-only
// Enqueue a 16-bit entry (D:E) into the command queue at the current write-head. If the head slot is
// free (bit 7 set) store the entry hi/lo, advance the head two, clamp it up to the floor and commit;
// otherwise leave the queue untouched. The caller's saved pointer is restored either way, and the body
// moves no stack (the push/pop pair collapses to saving and restoring the pointer in place).
import { loc_40a0, loc_4000 } from "./names.js";

const SLOT_FREE = 0x80;  // bit 7 of the head slot marks it writable
const HEAD_FLOOR = 0xc0; // lowest permitted write-head index

export function enqueueCommandWord(m, entry = m.regs.de, savedPtr = m.regs.hl) {
  const { mem8 } = m;

  const head = mem8[loc_40a0];
  const slot = loc_4000 + head;
  if (mem8[slot] & SLOT_FREE) {
    mem8[slot] = entry >> 8;                        // hi byte
    mem8[loc_4000 + ((head + 1) & 0xff)] = entry;  // lo byte (store truncates)
    let next = (head + 2) & 0xff;
    if (next < HEAD_FLOOR) next = HEAD_FLOOR;
    mem8[loc_40a0] = next;                          // commit the advanced write-head
  }
  return (m.regs.hl = savedPtr);
}
