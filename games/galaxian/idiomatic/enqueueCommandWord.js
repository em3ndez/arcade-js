// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueCommandWord -- the producer half of the deferred display/sound command queue.
 *
 * WHAT IT IS
 *   Handlers across the machine rarely draw or make sound in place; instead they append a 16-bit
 *   "command word" to a small ring buffer and let a per-frame drain do the real work later. This routine
 *   is that append. The word is a channel selector in the high byte (a small number 0-7 that names a draw
 *   or sound handler) and a parameter in the low byte. The word arrives in DE (entry); HL (savedPtr) is a
 *   caller pointer that is preserved across the call and handed straight back.
 *
 * ROLE IN THE MACHINE
 *   The queue is a 32-slot ring on page 0x40, its body at 0x40c0-0x40ff, two bytes per slot. The write
 *   head is a single-byte offset kept in loc_40a0 (0x40a0); the slot base is loc_4000 (0x4000), so
 *   slot = 0x4000 + head addresses a cell up in the 0x40c0-0xff window. A slot is FREE when the high bit
 *   (0x80) of its first byte is set; a queued word clears that bit, because a channel number 0-7 never
 *   sets bit 7. If the head slot is already occupied the queue is full and the append is silently
 *   dropped -- the caller's pointer is still returned unchanged, so a lost cue is invisible to the
 *   producer. The matching consumer decodeDisplayListSlotAndDispatch drains ready slots and vectors each
 *   channel to its draw/sound handler, which is where the deferred writes actually reach VRAM and the
 *   sound hardware.
 *
 * ROM 0x08f2.  Grounding: [seen]. Cells: write head loc_40a0 (0x40a0), slot base loc_4000 (0x4000).
 *
 * LIVE-OUT: mem8 (the stored word plus the advanced/committed head) and m.regs.hl = savedPtr. On a full
 * queue nothing is written and only HL is restored. The ROM's push/pop of HL collapses here to saving
 * and restoring the pointer in place, so no guest stack moves.
 */
import { loc_40a0, loc_4000 } from "./names.js";

// Bit 7 of a slot's first byte marks it writable. A channel number (0-7) never sets bit 7, so a queued
// word clears the flag and the slot then reads as "occupied" to the drain.
const SLOT_FREE = 0x80;  // bit 7 of the head slot marks it writable
// The queue body lives at 0x40c0-0x40ff; the head is clamped up to this floor after every advance so it
// never wanders below the ring into the score/HUD scratch sitting just beneath it (0x40a2-0x40bf).
const HEAD_FLOOR = 0xc0; // lowest permitted write-head index

export function enqueueCommandWord(m, entry = m.regs.de, savedPtr = m.regs.hl) {
  const { mem8 } = m;

  // Read the current write head and form the target slot address on page 0x40.
  const head = mem8[loc_40a0];
  const slot = loc_4000 + head;
  // Only append when the head slot is still free (bit 7 set); a full queue drops the word entirely.
  if (mem8[slot] & SLOT_FREE) {
    // Store the word big-endian: the channel/control byte in the slot, the parameter in the next cell.
    // The (+1 & 0xff) keeps the low-byte index on page 0x40 even for a slot at the very top of the ring.
    mem8[slot] = entry >> 8;                        // hi byte
    mem8[loc_4000 + ((head + 1) & 0xff)] = entry;  // lo byte (store truncates)
    // Advance the head two bytes (one slot). If the +2 wrapped it below the ring floor, clamp it back up
    // to 0xc0 so the head keeps circling the 0xc0-0xff window rather than dropping out of the ring.
    let next = (head + 2) & 0xff;
    if (next < HEAD_FLOOR) next = HEAD_FLOOR;
    mem8[loc_40a0] = next;                          // commit the advanced write-head
  }
  // Restore and hand back the caller's saved pointer whether or not the append happened.
  return (m.regs.hl = savedPtr);
}
