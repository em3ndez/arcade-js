// SPDX-License-Identifier: GPL-3.0-only
/** postGameOverBanner — the last life is gone: queue the PLAYER-n caption and then the GAME OVER
 * caption, hold them by arming the sequence countdown, and step the inner sequence index on. The
 * first pair's argument goes up by one while the second player is the one up, which is what picks
 * PLAYER 2 over PLAYER 1.
 * The routine also carries an arm that has nothing to do with a banner: reached with play NOT
 * active, it hands off to restartAttractSequence and never comes back here. That arm has never
 * been seen taken.
 * LIVE-OUT: memory, plus the last command pair queued. */

import { PLAY_ACTIVE, ACTIVE_PLAYER, SEQUENCE_DELAY } from "./names.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { postCommand } from "./postCommand.js";
import { restartAttractSequence } from "./restartAttractSequence.js";

const TIMER_RELOAD = 180;

const FIRST_COMMAND = 2;
const FIRST_ARGUMENT = 9;
const SECOND_COMMAND = 10;
const SECOND_ARGUMENT = 11;

export function postGameOverBanner(m) {
  const { regs, mem8 } = m;

  if (mem8[PLAY_ACTIVE] === 0) {
    restartAttractSequence(m);
    return;
  }

  regs.d = FIRST_COMMAND;
  regs.e = FIRST_ARGUMENT + (mem8[ACTIVE_PLAYER] === 0 ? 0 : 1);
  postCommand(m);

  regs.d = SECOND_COMMAND;
  regs.e = SECOND_ARGUMENT;
  postCommand(m);

  mem8[SEQUENCE_DELAY] = TIMER_RELOAD;
  advanceSequenceSubStep(m);
}
