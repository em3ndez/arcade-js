// SPDX-License-Identifier: GPL-3.0-only
/**
 * composeScreenAndAdvanceSubstate — post this intro step's draw work and the "1UP" score
 * marker, then step the in-game sequence on.
 *
 * One step of the pre-gameplay screen build that runs before each board — the sequence that
 * puts up the "how high can you get?" screen. Its neighbours clear the screen and run the
 * opening Kong-climb cutscene. This step does three things and takes no input at all:
 *
 *   1. POST a fixed four-message batch onto the deferred-task ring, as (opcode, argument)
 *      pairs. The main loop drains the ring and dispatches each message by its opcode as
 *      deferred draw/setup work. One of the four opcodes is the screen-text handler; the
 *      other two are further composition steps of this same screen and are not decoded
 *      here. The certain fact is the fixed batch that is posted.
 *   2. ADVANCE GAME_SUBSTATE by one, so next frame's dispatch selects the following step.
 *   3. STAMP player 1's static "1UP" score marker into three tilemap cells.
 *
 * A leaf over the task post and the marker stamp: it writes only the task ring and its
 * tail, the sub-state byte, and the three marker cells, and reads no input byte.
 *
 * LIVE-OUT: memory-only.
 */

import { GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { draw1UpLabel } from "./draw1UpLabel.js";

// The fixed batch of deferred-work messages this step posts, as [opcode, argument]
// pairs in post order.
const SCREEN_TASKS = [
  [0x03, 0x04],
  [0x02, 0x02],
  [0x02, 0x00],
  [0x06, 0x00],
];

export function composeScreenAndAdvanceSubstate(m) {
  const { regs, mem } = m;

  // 1. Post the four fixed messages. The post primitive reads each pair out of the
  //    register image, so stage it there before the call; it never writes them back.
  for (const [opcode, argument] of SCREEN_TASKS) {
    regs.d = opcode;
    regs.e = argument;
    enqueueTask(m);
  }

  // 2. Advance the in-game sub-state selector (8-bit wrap).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 3. Stamp player 1's static "1UP" marker.
  draw1UpLabel(m);
}
