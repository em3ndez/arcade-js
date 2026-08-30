// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_RING_WRITE_PTR, HIGH_SCORE_TABLE } from "./names.js";
/**
 * enqueueSoundCommandRing — append one command byte to the sound-command ring buffer and
 * advance the write cursor, wrapping the last slot back to the first. [seen]
 *
 * ROM 0x0eb3-0x0ece. A pure leaf: touches only memory, calls nothing.
 *
 * The main CPU does not make sound directly; it hands requests to the audio subsystem through
 * a small circular queue in shared work RAM. The queue occupies slots 0x8a43..0x8a5e — a
 * 28-byte run addressed as HIGH_SCORE_TABLE (0x8a00) + a one-byte index. SOUND_RING_WRITE_PTR
 * (0x8a40) holds that index: the offset of the next slot to fill. (These live on the same
 * 0x8a00 page as the high-score table, hence the base; the ring is its own region within it.)
 *
 * This routine performs the classic ring enqueue: store at the tail, then bump the tail with
 * wraparound. Boot fills the slots with 0xff to mark them empty; the audio side drains them.
 *
 * The original preserves BC/DE/HL around the store, so none of those registers are disturbed
 * here. LIVE-OUT: memory only — the filled slot and the advanced write pointer. Enqueue sites
 * reload A themselves, so A is not treated as a live-out.
 */

// Tail index range within the page: slots run 0x43..0x5e. Reaching the last slot means the
// next write must wrap around to the first rather than run off the end of the ring.
const RING_TAIL_LAST = 0x5e; // last slot index
const RING_TAIL_FIRST = 0x43; // first slot index; the write pointer wraps back here

export function enqueueSoundCommandRing(m, command = m.regs.a) {
  const { mem8 } = m;

  // Read the current tail (the index of the next free slot) and drop the command into it.
  const tail = mem8[SOUND_RING_WRITE_PTR];
  mem8[HIGH_SCORE_TABLE + tail] = command;

  // Advance the tail one slot, wrapping the last slot back to the first so the queue is
  // circular. The audio subsystem consumes from the other end.
  mem8[SOUND_RING_WRITE_PTR] = tail === RING_TAIL_LAST ? RING_TAIL_FIRST : tail + 1;
}
