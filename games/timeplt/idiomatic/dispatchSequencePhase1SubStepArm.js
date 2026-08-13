// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequencePhase1SubStepArm — the second level of the two-level sequence machine: look the
 * inner step index up in a table of addresses inline just after this entry, run the arm it names,
 * then run this mode's shared tail. The index is used RAW and the doubling into an entry offset wraps
 * at eight bits, so a large index folds back onto the head of the table. The arm is reached by a jump
 * with the tail parked as its return — load-bearing, because each arm ends by returning to it. The
 * tail is now a direct call then its ret; its gate drops the register file, so sp (restored by the
 * ret) is the only live-out register. LIVE-OUT: memory and sp. */

import { SEQUENCE_SUBSTEP, advanceSequenceElseStartFreePlayGame_ADDR, loc_1659 } from "./names.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { advanceSequenceElseStartFreePlayGame } from "./advanceSequenceElseStartFreePlayGame.js";

export function dispatchSequencePhase1SubStepArm(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[SEQUENCE_SUBSTEP];
  regs.hl = loc_1659;
  const arm = fetchTableWord(m);
  regs.de = regs.hl;
  regs.hl = arm;
  m.push16(advanceSequenceElseStartFreePlayGame_ADDR);
  m.call(arm);
  advanceSequenceElseStartFreePlayGame(m);
  return m.ret();
}
