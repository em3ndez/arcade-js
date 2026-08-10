// SPDX-License-Identifier: GPL-3.0-only
/** enqueueFixedCommandOnRing — queue one fixed command, with its one fixed argument, in the command ring. Both bytes are constants
 * chosen here, so the whole content of this entry is WHICH pair goes out, and whatever a caller was holding in the
 * command registers is thrown away. Queueing is not a guarantee: the pair is dropped when the cell the write cursor
 * names is unconsumed, and this entry never learns that. LIVE-OUT: memory, plus the pair, left in the registers. */

import { postCommand } from "./postCommand.js";

const COMMAND = 1;
const ARGUMENT = 31;

export function enqueueFixedCommandOnRing(m) {
  m.regs.d = COMMAND;
  m.regs.e = ARGUMENT;
  postCommand(m, COMMAND, ARGUMENT);
}
