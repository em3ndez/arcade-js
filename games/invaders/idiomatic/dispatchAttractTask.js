// SPDX-License-Identifier: GPL-3.0-only
import { TASK_FLAGS } from "./names.js";
import { runAttractObjectTail } from "./runAttractObjectTail.js";
import { walkAttractObjectTable } from "./walkAttractObjectTable.js";
import { stepAnimationFrame } from "./stepAnimationFrame.js";

/**
 * dispatchAttractTask — the attract-mode per-frame task selector.
 *
 * WHAT IT IS
 *   During the attract demo, this runs from the vblank interrupt and does exactly one piece of work
 *   per frame, chosen from the TASK_FLAGS (0x20c1) bitfield. It tests the low three bits in priority
 *   order and tail-calls the first task whose bit is set, so at most one task runs per frame; when no
 *   bit is set it is a no-op. The ROM (loc_0abf) reads TASK_FLAGS and rotates the byte right one bit at
 *   a time, jumping on each carry — bit0 first, then bit1, then bit2 — which is the priority order here.
 *
 * ROLE IN THE MACHINE
 *   Reached from idiomaticVblankNmi during the attract demo (GAME_ACTIVE set, GAME_IN_PROGRESS clear,
 *   no credits pending). TASK_FLAGS is the one-byte record of which drawing/animation task the frame
 *   owes; storeTaskFlags writes it, and the foreground attract spine (runAttractCycle) arms the bits.
 *     - bit0 (0x01) -> runAttractObjectTail: the shared vblank in-game record tail (pending-alien draw,
 *       the main object-table walk, and the saucer timer) — the same body the live game runs each frame.
 *     - bit1 (0x02) -> stepAnimationFrame: advance one frame of the scripted title-screen animation.
 *     - bit2 (0x04) -> walkAttractObjectTable: walk the attract demo's own object table at 0x2050.
 *   Reads only TASK_FLAGS; the selected task does the real work.
 *
 * ROM 0x0abf-0x0ace.  Grounding: [seen] (TASK_FLAGS is [seen]).
 *
 * LIVE-OUT: whatever the selected task leaves; a no-op when no bit is set.
 */
export function dispatchAttractTask(m) {
  // Snapshot the task bitfield once so the three tests read a stable value.
  const flags = m.mem8[TASK_FLAGS];
  // Priority order matches the ROM's successive right-rotates: bit0 wins, then bit1, then bit2. Each
  // arm tail-returns, so exactly one task runs (or none).
  if (flags & 0x01) return runAttractObjectTail(m);
  if (flags & 0x02) return stepAnimationFrame(m);
  if (flags & 0x04) return walkAttractObjectTable(m);
}
