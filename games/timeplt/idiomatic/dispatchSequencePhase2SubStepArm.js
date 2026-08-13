// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequencePhase2SubStepArm — the second level of the two-level sequence machine, for one of the outer machine's
 * modes: look the inner step index up in a table of addresses that sits inline just after this
 * entry, run the arm it names, then run this mode's shared tail. The index is used RAW and the
 * doubling that turns it into an entry offset wraps at eight bits, so a large index folds back
 * onto the head of the table. The tail does nothing at all, which is why every arm here simply
 * ends. The lookup's by-products are left standing for the arm to read. Nothing is written.
 * LIVE-OUT: memory and registers, all of them the arm's. */

import { SEQUENCE_SUBSTEP, PHASE2_SUBSTEP_DISPATCH_TABLE } from "./names.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { noOpSequencePhase2Tail } from "./noOpSequencePhase2Tail.js";

export function dispatchSequencePhase2SubStepArm(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[SEQUENCE_SUBSTEP];
  regs.hl = PHASE2_SUBSTEP_DISPATCH_TABLE;
  const arm = fetchTableWord(m);
  regs.de = regs.hl;
  regs.hl = arm;
  m.call(arm);
  return noOpSequencePhase2Tail(m);
}
