// SPDX-License-Identifier: GPL-3.0-only
/** postNextParachutistBonus — run one slot's countdown down by one and post the next command of a four-step run.
 * The step number is kept in the slot's own record and is read before it is stepped on, so the
 * first visit posts step zero. Each of the four steps supplies its own argument from a table;
 * once the number has gone past the last of them every further visit posts one fixed argument
 * instead, and the number keeps climbing rather than stopping or wrapping. All four steps and the
 * one past them share a single command byte, so what varies from visit to visit is the argument
 * alone. LIVE-OUT: memory, plus the command pair left standing in the registers. */

import { offsetAddress } from "./offsetAddress.js";
import { postCommand } from "./postCommand.js";

const COUNTDOWN = 0;
const STEP = 7;
const STEP_TABLE = 0x484f;
const STEPS = 4;
const COMMAND = 4;
const PAST_THE_LAST_STEP = 15;

export function postNextParachutistBonus(m) {
  const { mem8, regs } = m;
  const record = regs.ix;

  mem8[record + COUNTDOWN] = mem8[record + COUNTDOWN] - 1;
  const step = mem8[record + STEP];
  mem8[record + STEP] = step + 1;

  let argument = PAST_THE_LAST_STEP;
  if (step < STEPS) {
    regs.hl = STEP_TABLE;
    regs.a = step;
    argument = mem8[offsetAddress(m)];
  }
  regs.d = COMMAND;
  regs.e = argument;
  postCommand(m, COMMAND, argument);
}
