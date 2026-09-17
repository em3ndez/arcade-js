// SPDX-License-Identifier: GPL-3.0-only
/**
 * composeScreenAndAdvanceSubstate — one step of the "how high can you get?" screen build: post a
 * fixed four-message batch onto the deferred-task ring, advance GAME_SUBSTATE by one, and stamp
 * player 1's static "1UP" marker.
 *
 * LIVE-OUT: memory-only.
 */

import { GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { draw1UpLabel } from "./draw1UpLabel.js";

const SCREEN_TASKS = [
  [0x03, 0x04],
  [0x02, 0x02],
  [0x02, 0x00],
  [0x06, 0x00],
];

export function composeScreenAndAdvanceSubstate(m) {
  const { regs, mem8 } = m;

  for (const [opcode, argument] of SCREEN_TASKS) {
    regs.d = opcode;
    regs.e = argument;
    enqueueTask(m);
  }

  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1) & 0xff;

  draw1UpLabel(m);
}
