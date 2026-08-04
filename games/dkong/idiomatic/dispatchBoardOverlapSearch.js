// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardOverlapSearch — vector to the current board's collision-search arm,
 * handing it the caller's bounds word across the dispatch.
 *
 * The caller hands over a bounds word in a register and wants the board-specific
 * object-overlap search run for it. This routine reads the board type BOARD and
 * vectors through its own 6-entry inline jump table to that board's arm:
 *   board 0 — a reset-vector guard for an out-of-range board
 *   board 1 — 25m: recover the bounds, count object overlaps, return a code
 *   boards 2, 3, 4 — that board's collision arm
 *   board 5 — a reset-vector guard
 * The board-1 arm is what makes this dispatch worth having as its own routine: on 25m
 * it COUNTS object overlaps rather than running the plain girder collision. The
 * selected arm's value passes straight back to the caller — this routine adds no frame
 * of its own, the dispatch is its last act.
 *
 * THE BOUNDS WORD IS HANDED TO THE ARM THROUGH THE STACK, not a register: the shared
 * dispatch trampoline clobbers the register pair while it recovers its own table base,
 * so the word is stacked first and the arm's opening move lifts it back off as its
 * collision bounds. That hand-off is genuine data, not call plumbing — dropping it
 * feeds the arm a garbage bounds word.
 *
 * The dispatch itself is the shared inline-table trampoline: it recovers the table
 * base off the stack, reads the little-endian target word at table[board], and vectors
 * to it. Its ABI still takes the table base off the stack, so this routine hands it
 * that base as the top word, above the stacked bounds.
 *
 * LIVE-OUT: whatever the arm wrote to memory, plus the arm's returned value and the
 * collision code and record pointer it leaves in registers, which the caller reads
 * back. The trampoline's own register/flag handoff into the arm is dead to this
 * routine's caller.
 */

import { BOARD } from "./names.js";
import { dispatchInlineJumpTable } from "./dispatchInlineJumpTable.js";

// This routine's own inline jump table: 6 little-endian target words, indexed by BOARD.
const BOARD_DISPATCH_TABLE = 0x3e8d;

// The dispatch-site label handed down to the generic dispatcher; it only ever surfaces
// inside a NotImplemented throw, when an out-of-range board indexes a null guard entry.
const DISPATCH_SITE = "0x3E8D (loc_3e88 dispatch)";

export function dispatchBoardOverlapSearch(m) {
  const { regs, mem } = m;

  // The board type selects which arm of the inline table runs.
  regs.a = mem.read8(BOARD);

  // The caller's bounds word, handed across the dispatch to the selected arm (the
  // trampoline clobbers the register recovering its table base, and the arm lifts this
  // back off the stack). Sits BELOW the table base.
  m.push16(regs.hl);

  // Dispatch through the inline table. The trampoline takes its table base off the
  // stack, so hand it that base as the top word, then it reads table[board] and vectors
  // to the arm; the arm's value passes straight up to the caller.
  m.push16(BOARD_DISPATCH_TABLE);
  return dispatchInlineJumpTable(m, DISPATCH_SITE);
}
