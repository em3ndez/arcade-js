// SPDX-License-Identifier: GPL-3.0-only
/** dispatchInlineWordTableIndexedByA — run the arm a caller's index selects out of a table the caller lays down directly behind its transfer
 * here. THE TABLE ADDRESS ARRIVES ON THE STACK, in the place the transfer would otherwise come back to, and consuming
 * it is exactly what turns the caller's next bytes into a table instead of instructions — so the stack read below is
 * this routine's argument, not bookkeeping. The arm is entered as a jump; control never returns to the table. */

import { fetchTableWord } from "./fetchTableWord.js";

export function dispatchInlineWordTableIndexedByA(m) {
  const { regs } = m;
  regs.hl = m.pop16();
  const arm = fetchTableWord(m);
  regs.de = regs.hl;
  regs.hl = arm;
  return m.call(arm);
}
