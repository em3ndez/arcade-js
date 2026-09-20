// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardOverlapSearch — vector to the current board's object-overlap collision arm through
 * this routine's own 6-entry inline jump table, indexed by BOARD (25m counts overlaps; boards 0/5
 * are reset-vector guards). The selected arm's value passes straight back to the caller.
 *
 * The caller's bounds word is handed to the arm through the STACK, not a register: the trampoline
 * clobbers the register pair recovering its table base, so the word is stacked below the base and
 * the arm lifts it back off — dropping it feeds the arm a garbage bounds word.
 *
 * LIVE-OUT: whatever the arm wrote to memory, plus the arm's returned value and the collision code
 * and record pointer it leaves in registers.
 */

import {
  BOARD,
  BOARD_OVERLAP_DISPATCH_TABLE,
} from "./names.js";
import { dispatchInlineJumpTable } from "./dispatchInlineJumpTable.js";

const DISPATCH_SITE = "0x3E8D (loc_3e88 dispatch)";

export function dispatchBoardOverlapSearch(m, hl = m.regs.hl) {
  const { mem8 } = m;

  // The caller's bounds word, below the table base; the arm lifts it back off the stack.
  return (m.regs.a = mem8[BOARD], m.push16(hl), m.push16(BOARD_OVERLAP_DISPATCH_TABLE), dispatchInlineJumpTable(m, DISPATCH_SITE));
}
