// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueTask — post a two-byte [opcode, argument] message onto the task ring.
 *
 * A slot is free only while bit 7 of its opcode byte is set; if the tail slot is occupied the ring
 * is full there and the post is silently dropped. Otherwise the pair is stored and the tail steps by
 * two, wrapping back to the first slot within the fixed page.
 *
 * LIVE-OUT: memory-only — the tail and the two written ring bytes.
 */

import { page } from "../../../core/int.js";
import { TASK_TAIL, TASK_RING } from "./names.js";

const PAGE = page(TASK_RING);
const RING_BASE = TASK_RING & 0xff; // low byte of the first slot, and the wrap floor

export function enqueueTask(m, d = m.regs.d, e = m.regs.e) {
  const { mem8 } = m;

  const tail = mem8[TASK_TAIL];
  const slot = PAGE | tail;

  // Full here if bit 7 of the slot's opcode is clear: drop the message, leave the tail alone.
  if ((mem8[slot] & 0x80) === 0) return;

  mem8[slot] = d;
  mem8[PAGE | ((tail + 1) & 0xff)] = e;

  let next = (tail + 2) & 0xff;
  if (next < RING_BASE) next = RING_BASE;
  mem8[TASK_TAIL] = next;
}
