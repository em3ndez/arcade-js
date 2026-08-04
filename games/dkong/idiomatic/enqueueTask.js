// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueTask — post a 2-byte [opcode, argument] message onto the task ring.  ROM 0x309F.
 *
 * The game's deferred-work queue. A caller that wants a unit of work run later
 * (add to score, start a sound, bump a counter…) posts it here rather than doing
 * it inline; the main loop drains the ring and dispatches each message. This is
 * the shared "post a task" primitive — dozens of call sites feed it.
 *
 * The ring is 32 slots of 2 bytes at TASK_RING (0x60C0–0x60FF), all living in
 * page 0x60. TASK_TAIL (0x60B0) holds the LOW byte of the next write slot (the
 * high byte is fixed at 0x60). The message payload arrives in the Z80 D/E pair:
 * D = opcode, E = argument.
 *
 *   - A slot is FREE only while bit 7 of its opcode byte is SET — 0xFF is the
 *     empty marker (boot fills the whole ring with 0xFF), not zero. If the slot
 *     at the tail is occupied, the ring is full there and the post is silently
 *     dropped (no write, tail untouched).
 *   - Otherwise write D then E into the slot pair, then advance the tail by 2.
 *     The advance is 8-bit within page 0x60; when it steps past 0xFF it wraps
 *     back to the ring base 0xC0 (the oracle's `cp 0xC0 / jp nc`: a new low byte
 *     below 0xC0 means it wrapped, so it is pinned to the base).
 *
 * A LEAF: calls nothing. Reads D/E and the ring; writes only the ring + tail.
 *
 * Memory-equivalent to the frozen oracle — equivalence-309f.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (the task-post
 *           primitive, fires as the game schedules work) + crafted DROP / WRAP
 *           arms attract never reaches. Attract only exercises the no-wrap write
 *           arm; the full ring / occupied-slot / wrap-around arms are crafted.
 * LIVE-OUT: memory-only — TASK_TAIL and the two written ring slots. The oracle
 *           preserves HL (push/pop) and never touches D/E, and its residual A/F
 *           are dead ABI (checked successors releaseBarrelIntoFreeSlot, handler_0779, loc_08ba
 *           read neither). pc/SP are the dropped stack model — the oracle's `ret`
 *           becomes the JS return here — so the sole oracle-vs-idiomatic residue
 *           is the pushed-HL bytes in STACK_SCRATCH, excluded by the contract.
 * NAMES:    TASK_TAIL (0x60B0), TASK_RING (0x60C0) from names.js. Page 0x60 kept
 *           as the fixed high byte of every ring/tail address.
 */

import { TASK_TAIL, TASK_RING } from "./names.js";

const PAGE = TASK_RING & 0xff00; // 0x6000 — the fixed high byte of every slot address
const RING_BASE = TASK_RING & 0x00ff; // 0xC0 — low byte of the first slot / the wrap floor

export function enqueueTask(m) {
  const { regs, mem } = m;

  // TASK_TAIL is the low byte of the next write slot; the slot lives in page 0x60.
  const tail = mem.read8(TASK_TAIL);
  const slot = PAGE | tail;

  // Free only while bit 7 of the slot's opcode is set (0xFF = empty). If clear,
  // the ring is full at this slot: drop the message, leave the tail untouched.
  if ((mem.read8(slot) & 0x80) === 0) return;

  // Store the message pair [opcode, argument] = (D, E). The second write's low
  // byte is 8-bit-wrapped, matching the oracle's `inc l` (page stays 0x60).
  mem.write8(slot, regs.d);
  mem.write8(PAGE | ((tail + 1) & 0xff), regs.e);

  // Advance the tail by 2, wrapping back to the ring base when it runs past 0xFF.
  let next = (tail + 2) & 0xff;
  if (next < RING_BASE) next = RING_BASE;
  mem.write8(TASK_TAIL, next);
}
