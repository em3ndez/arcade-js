// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueTask — post a two-byte [opcode, argument] message onto the task ring.
 *
 * This is the game's deferred-work queue. Anything that wants a unit of work done later — add to
 * the score, start a sound, bump a counter — posts it here instead of doing it inline, and the main
 * loop drains the ring and dispatches each message. Dozens of call sites feed it.
 *
 * The ring is 32 two-byte slots, all inside one 256-byte page. The tail cell holds only the LOW
 * byte of the next slot to write; the page is fixed. The message itself arrives in a register pair,
 * opcode first.
 *
 *   - A slot is FREE only while bit 7 of its opcode byte is SET. The empty marker is 0xFF, not
 *     zero, and boot fills the whole ring with it. If the slot at the tail is occupied, the ring is
 *     full there and the post is silently DROPPED: nothing is written and the tail does not move.
 *   - Otherwise the opcode and its argument go into the slot pair and the tail advances by two.
 *     That advance stays inside the page, and when it steps past the end it is pinned back to the
 *     ring's first slot — a new low byte below the base is exactly what a wrap looks like.
 *
 * A LEAF: it calls nothing, and writes only the ring and the tail.
 *
 * LIVE-OUT: memory-only — the tail and the two written ring bytes.
 */

import { TASK_TAIL, TASK_RING } from "./names.js";

const PAGE = TASK_RING & 0xff00; // the fixed high byte of every slot address
const RING_BASE = TASK_RING & 0x00ff; // low byte of the first slot, and the wrap floor

export function enqueueTask(m) {
  const { regs, mem } = m;

  // The tail is the low byte of the next slot to write.
  const tail = mem.read8(TASK_TAIL);
  const slot = PAGE | tail;

  // Free only while bit 7 of the slot's opcode is set. If it is clear the ring is full here:
  // drop the message and leave the tail alone.
  if ((mem.read8(slot) & 0x80) === 0) return;

  // Store the message pair. The second byte's address wraps within the page.
  mem.write8(slot, regs.d);
  mem.write8(PAGE | ((tail + 1) & 0xff), regs.e);

  // Advance the tail by two, pinning it back to the first slot when it runs off the end.
  let next = (tail + 2) & 0xff;
  if (next < RING_BASE) next = RING_BASE;
  mem.write8(TASK_TAIL, next);
}
