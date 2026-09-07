// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillMemoryBlock -- the block-fill primitive (Z80 RST 10 vector).
 *
 * WHAT IT IS
 *   One of the shared page-zero verbs. Given a destination pointer (HL), a fill byte (A), and a count (B),
 *   it stores the byte into `count` successive addresses, walking the pointer forward, and stops when the
 *   count runs out. This is the routine that clears work-RAM spans and blanks stretches of the tile map
 *   wherever the game needs a region wiped in one stroke.
 *
 * ROLE IN THE MACHINE
 *   The count is decremented as an 8-bit value, so a request of 0 is NOT a no-op: the countdown wraps and
 *   the loop runs a full 256 times. The body is a do/while, so it always writes at least one byte. It
 *   leaves the pointer sitting just past the filled region and the count spent (B = 0).
 *
 * ROM 0x0010 (RST 10).  Grounding: [seen]. No named cells -- it fills whatever the caller's pointer names.
 *
 * LIVE-OUT: mem8[dest .. dest+count-1] = value; m.regs.hl = the pointer past the fill; m.regs.b = 0.
 */
import { u16 } from "../../../core/int.js";

export function fillMemoryBlock(m, dest = m.regs.hl, value = m.regs.a, count = m.regs.b) {
  const { mem8 } = m;

  // Walk a local pointer and an 8-bit down-counter; the count-0 -> 256 wrap is why this is a do/while.
  let ptr = dest;
  let remaining = count;
  do {
    // Store the fill byte, step the pointer forward (16-bit wrap), and tick the count down one.
    mem8[ptr] = value;
    ptr = u16(ptr + 1);
    remaining = (remaining - 1) & 0xff; // wraps 0 -> 255, so count 0 fills 256 bytes
  } while (remaining !== 0);

  // Hand back the pointer past the filled region and the spent count (B = 0).
  return (m.regs.hl = ptr, m.regs.b = 0);
}
