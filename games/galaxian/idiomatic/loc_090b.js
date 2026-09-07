// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_090b — shared stack epilogue of the command-queue write path.
 *
 * WHAT IT IS
 *   A one-instruction tail (POP HL; RET) that several routines on the enqueueCommandWord / commitQueueWriteHead
 *   path fall through to. It restores the caller's saved HL from the stack and returns it. Because the value
 *   comes off the return stack it is a genuine pop, not a load from a named work-RAM cell, so this routine
 *   touches no game state.
 *
 * ROM 0x090b.  Grounding: [seen].  Live-out: HL = the restored (popped) pointer.  Writes no RAM.
 */

// HL is restored from the stack, so it is a genuine pop, not a load from a named cell.
export function loc_090b(m) {
  return (m.regs.hl = m.pop16());
}
