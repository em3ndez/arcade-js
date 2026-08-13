// SPDX-License-Identifier: GPL-3.0-only
/** loadActivePlayerContextAndPostRoundHud — set up the active player's turn and guard the picture on a program-image checksum.
 * Blank a run of character cells and copy the active player's saved sixteen-byte context into the
 * live block. When play is inactive, just step the sequence sub-index; otherwise also post the round
 * number and the lives-less-one as commands and fold a fixed program span into an XOR whose low bit,
 * less one, drives the picture-enable latch — darkening the screen if it changed. LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { blankFourteenCharCells } from "./blankFourteenCharCells.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { postCommand } from "./postCommand.js";
import {
  ACTIVE_PLAYER, PLAYER_ONE_LIVES, PLAYER_TWO_LIVES,
  LIVES_REMAINING, ROUND_NUMBER, PLAY_ACTIVE,
  TAMPER_CHECKSUM_SPAN_BASE, VIDEO_ENABLE_LATCH,
} from "./names.js";

const CONTEXT_BYTES = 16;
const CHECKSUM_BYTES = 256;
const LATCH_WRITE_OFFSET = 10;
const ROUND_COMMAND = 6;
const LIVES_COMMAND = 5;

export function loadActivePlayerContextAndPostRoundHud(m) {
  const { mem8 } = m;
  blankFourteenCharCells(m);

  const saved = mem8[ACTIVE_PLAYER] === 0 ? PLAYER_ONE_LIVES : PLAYER_TWO_LIVES;
  for (let i = 0; i < CONTEXT_BYTES; i++) mem8[LIVES_REMAINING + i] = mem8[saved + i];

  if (mem8[PLAY_ACTIVE] === 0) return advanceSequenceSubStep(m);

  postCommand(m, ROUND_COMMAND, mem8[ROUND_NUMBER]);
  postCommand(m, LIVES_COMMAND, u8(mem8[LIVES_REMAINING] - 1));

  let checksum = 0;
  for (let i = 0; i < CHECKSUM_BYTES; i++) checksum ^= mem8[TAMPER_CHECKSUM_SPAN_BASE + i];
  m.mem.write8(VIDEO_ENABLE_LATCH, u8(checksum - 1), LATCH_WRITE_OFFSET);

  return advanceSequenceSubStep(m);
}
