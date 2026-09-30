// SPDX-License-Identifier: GPL-3.0-only
/** enqueueFixedCommandOnRing — queue one fixed command, with its one fixed argument, in the command ring. Both bytes are constants
 * chosen here, so the whole content of this entry is WHICH pair goes out, and whatever a caller was holding in the
 * command registers is thrown away. Queueing is not a guarantee: the pair is dropped when the cell the write cursor
 * names is unconsumed, and this entry never learns that. LIVE-OUT: memory, plus the pair, left in the registers.
 *
 * ROM 0x0B46-0x0B4B (frozen lift loc_0b46): `ld de,0x011f` then `jp 0x0038` — a tail jump into
 * postCommand. Grounding: [seen] (names.js ROUTINES 0x0B46).
 *
 * Role in the machine: the command ring is a queue of deferred work (captions, score awards).
 * Producers post a (command, argument) pair into COMMAND_RING, and the foreground drain loop (runCommandRingDrainLoop) takes each pair and runs the handler the
 * command selects from the table at 0x0BBC. Command 1 is drawTextRunByIndex — draw a caption in
 * its own colour — and the argument is the caption record number. So this entry asks for caption
 * record 31 to be drawn. Its known use (mechanisms.md, command ring): flashCopyrightLine calls it
 * on even FRAME_TICK values to draw the copyright line in colour 0x05, alternating with record 0
 * (colour 0x10) on odd ticks, which is what makes the copyright line flash.
 */

import { postCommand } from "./postCommand.js";

const COMMAND = 1; // D = 0x01: ring command 1, drawTextRunByIndex
const ARGUMENT = 31; // E = 0x1F: caption record 31

export function enqueueFixedCommandOnRing(m) {
  /* Post the pair (rst 0x38 / postCommand). If the ring cell under COMMAND_WRITE_CURSOR still
   * holds an unconsumed pair, postCommand returns without writing and the request is lost. */
  postCommand(m, COMMAND, ARGUMENT);
  /* The ROM loaded the pair into D and E before jumping, and nothing clears them, so a caller
   * resumes with DE = 0x011F. Returned and left in the registers to match. */
  return [(m.regs.d = COMMAND), (m.regs.e = ARGUMENT)];
}
