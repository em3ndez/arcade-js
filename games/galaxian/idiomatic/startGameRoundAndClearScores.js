// SPDX-License-Identifier: GPL-3.0-only
// Start/spawn setup: store the 16-bit spawn pointer, blit the 32-byte row template into the flag-bitmap
// buffer, optionally arm the sub-state advance gate on a config bit, seed the spawn work-RAM state, then
// queue three spawn command words (the last as a tail delegate).
import { armSubstateAdvanceGate } from "./armSubstateAdvanceGate.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  CURRENT_PLAYER,
  loc_051b,
  PACKED_FLAG_BITMAP,
  loc_401f,
  SEQUENCE_STATE,
  GAME_STATE,
  loc_4006,
  loc_41d1,
} from "./names.js";

const TEMPLATE_BYTES = 32;

export function startGameRoundAndClearScores(m, ptr = m.regs.hl) {
  const { mem8, mem16 } = m;

  mem16[CURRENT_PLAYER] = ptr;

  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[PACKED_FLAG_BITMAP + i] = mem8[loc_051b + i];

  if (mem8[loc_401f] & 1) armSubstateAdvanceGate(m); // config bit0 -> arm the gate

  mem8[SEQUENCE_STATE] = 0;
  mem8[GAME_STATE] = 3;
  mem8[loc_4006] = 1;
  mem8[loc_41d1] = 1;

  // Queue three spawn command words; the third is the tail delegate.
  enqueueCommandWord(m, (6 << 8) | 4);
  enqueueCommandWord(m, 4 << 8);
  return enqueueCommandWord(m, (4 << 8) | 1);
}
