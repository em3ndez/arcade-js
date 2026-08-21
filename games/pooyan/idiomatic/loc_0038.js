// SPDX-License-Identifier: GPL-3.0-only
import { DISPLAY_CMD_RING_WRITE_PTR } from "./names.js";
/**
 * loc_0038 — enqueue a two-byte display command into the page-0x88 command ring: if the pointed
 * slot is free (bit 7 set) store the command's high byte there and its low byte in the next slot,
 * advance the write pointer by two and wrap it back to the ring start once below it; an occupied
 * slot drops the command. HL is preserved.
 * LIVE-OUT: none (memory only) — the enqueued bytes and the advanced write pointer.
 */
const RING_START = 0xc0; //     low byte the ring begins at (pointer wraps back up to here)
const SLOT_FREE_BIT = 0x80; //  bit 7 set in a slot => free to write

export function loc_0038(m, cmd = m.regs.de) {
  const { mem8 } = m;
  const page = (DISPLAY_CMD_RING_WRITE_PTR >> 8) << 8; // the ring shares the pointer cell's page
  let low = mem8[DISPLAY_CMD_RING_WRITE_PTR];
  const slot = page + low;
  if ((mem8[slot] & SLOT_FREE_BIT) === 0) return;
  mem8[slot] = cmd >> 8;
  low = (low + 1) & 0xff;
  mem8[page + low] = cmd;
  low = (low + 1) & 0xff;
  if (low < RING_START) low = RING_START;
  mem8[DISPLAY_CMD_RING_WRITE_PTR] = low;
}
