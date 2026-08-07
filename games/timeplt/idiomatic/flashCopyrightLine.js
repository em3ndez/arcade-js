// SPDX-License-Identifier: GPL-3.0-only
/** flashCopyrightLine — queue one fixed command whose ARGUMENT alternates: the lowest bit of a counter cell
 * chooses between two of them, and nothing else about the pair varies. The counter is only read.
 * Queueing is not a guarantee — the append drops the pair when the ring cell the write cursor
 * names has not been consumed, and this entry never learns that.
 * LIVE-OUT: memory, plus the pair, left in the registers. */

import { loc_0b46 } from "./loc_0b46.js";
import { postCommand } from "./postCommand.js";
import { FRAME_TICK } from "./names.js";

const COMMAND = 1;
const ARGUMENT_ON_THE_ODD_TURN = 0;

export function flashCopyrightLine(m) {
  if ((m.mem8[FRAME_TICK] & 1) === 0) {
    loc_0b46(m);
    return;
  }
  m.regs.d = COMMAND;
  m.regs.e = ARGUMENT_ON_THE_ODD_TURN;
  postCommand(m, COMMAND, ARGUMENT_ON_THE_ODD_TURN);
}
