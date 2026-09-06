// SPDX-License-Identifier: GPL-3.0-only
// Per-frame ticker gated by bit 0 of the enable flag. A prescaler fires once every ten eligible frames;
// on each fire it enqueues a command word (opcode 2, current step) and steps the counter down. When the
// counter reaches zero the sequence ends: clear the enable flag and silence the sound register.
import { loc_4201, loc_4205, loc_4206, SOUND_W_REG3 } from "./names.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const COMMAND_OPCODE = 2;
const PRESCALE_RELOAD = 10;

export function loc_1327(m) {
  const { mem8 } = m;

  // Disabled unless bit 0 of the enable flag is set.
  if ((mem8[loc_4201] & 0x01) === 0) return;

  // Prescaler: fire only on the tenth eligible frame.
  mem8[loc_4205] = mem8[loc_4205] - 1;
  if (mem8[loc_4205] !== 0) return;
  mem8[loc_4205] = PRESCALE_RELOAD;

  // Emit the current step as a command word, then step the counter down.
  const step = mem8[loc_4206];
  enqueueCommandWord(m, (COMMAND_OPCODE << 8) | step, loc_4206);
  mem8[loc_4206] = step - 1;
  if (mem8[loc_4206] !== 0) return;

  // Sequence finished: disable and silence.
  mem8[loc_4201] = 0;
  mem8[SOUND_W_REG3] = 0;
}
