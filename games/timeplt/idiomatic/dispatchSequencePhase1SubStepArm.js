// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequencePhase1SubStepArm — the second level of the two-level sequence machine, for one of the outer machine's
 * modes: look the inner step index up in a table of addresses that sits inline just after this
 * entry, run the arm it names, then run this mode's shared tail. The index is used RAW and the
 * doubling that turns it into an entry offset wraps at eight bits, so a large index folds back
 * onto the head of the table. The arm is reached by a jump with the tail parked as its return —
 * that park is load-bearing, because each arm ends by returning to it. The tail is now a direct call
 * then its ret; its gate drops the register file, so sp (restored by the ret) is the only live-out
 * register and the rest are dead leftovers. LIVE-OUT: memory and sp. */

import { SEQUENCE_SUBSTEP } from "./names.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { advanceSequenceElseStartFreePlayGame } from "./advanceSequenceElseStartFreePlayGame.js";

const ARM_TABLE = 0x1659;
const SHARED_TAIL = 0x167b;

export function dispatchSequencePhase1SubStepArm(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[SEQUENCE_SUBSTEP];
  regs.hl = ARM_TABLE;
  const arm = fetchTableWord(m);
  regs.de = regs.hl;
  regs.hl = arm;
  m.push16(SHARED_TAIL);
  m.call(arm);
  advanceSequenceElseStartFreePlayGame(m);
  return m.ret();
}
