// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_RING_WRITE_PTR, HIGH_SCORE_TABLE } from "./names.js";
/**
 * loc_0eb3 — enqueue a command byte into the sound-command ring buffer. Stores the byte into
 * the slot named by the write pointer, then advances that pointer, wrapping the last slot to
 * the first. The original round-trips BC/DE/HL, so those registers are left untouched here.
 *
 * LIVE-OUT: memory only (filled slot + advanced write pointer); enqueue sites reload A.
 */

const RING_TAIL_LAST = 0x5e; //  last slot index; the write pointer wraps back to the first
const RING_TAIL_FIRST = 0x43;

export function loc_0eb3(m, command = m.regs.a) {
  const { mem8 } = m;

  const tail = mem8[SOUND_RING_WRITE_PTR];
  mem8[HIGH_SCORE_TABLE + tail] = command; // store into the ring slot
  mem8[SOUND_RING_WRITE_PTR] = tail === RING_TAIL_LAST ? RING_TAIL_FIRST : tail + 1;
}
