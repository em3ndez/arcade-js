// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueSoundCommand — append one sound request to the sound ring buffer.  ROM 0x4ca5.
 *
 * The shared tail of a fan of ~20 tiny sound-trigger stubs (0x4c1f..0x4ca3): each stub
 * loads a distinct sound-command index and jumps or falls into here. This routine marks
 * that index as a pending command (sets the high bit) and drops it into the next free
 * slot of the 8-slot sound ring buffer, then advances the ring's write pointer to the
 * following slot, wrapping back to slot 0 after the eighth. The sound driver drains the
 * ring elsewhere; the high bit is how it tells a filled slot from an empty one.
 *
 * The command index is delivered in a register by the calling stub — the one genuine
 * oracle boundary this routine reads across — so it is exposed as a parameter that
 * defaults to that register when called through the stub path (the gate and the live
 * registry both enter this way). A fully-decompiled caller can pass the index directly.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4ca5.test.js.
 * GATE:     real captured dispatches (RAM outside the transient stack scratch, plus
 *           pc + SP) — attract exercises every write pointer 0..7, so the ring wrap is
 *           covered live; a crafted pointer==7 entry pins the wrap explicitly. Reached
 *           from the sound-trigger stubs during boot/attract (145 dispatches / 3000 frames).
 * LIVE-OUT: memory-only — the filled ring slot (SOUND_RING) and the advanced write
 *           pointer (SOUND_HEAD). The command-with-high-bit and flags the oracle leaves
 *           behind are dead scratch no caller reads; the two saved-and-restored register
 *           pairs it parks on the stack are dead too.
 * NAMES:    SOUND_HEAD (ring write pointer), SOUND_RING (8-slot buffer base) from ram.js.
 */
import { SOUND_HEAD, SOUND_RING } from "./ram.js";

export function enqueueSoundCommand(m, commandIndex = m.regs.a) {
  const { mem8 } = m;

  // Take the current write slot, then advance the pointer to the next of the 8 slots.
  const slot = mem8[SOUND_HEAD];
  mem8[SOUND_HEAD] = (slot + 1) % 8;

  // Fill that slot with the command, high bit set to mark the slot as pending.
  mem8[SOUND_RING + slot] = commandIndex | 0x80;
}
