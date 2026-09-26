// SPDX-License-Identifier: GPL-3.0-only
/** loc_0774 — round-start sequence arm: verify a fixed program span, post the round-start caption
 * commands, repaint the kill meter, reset the playfield for the new round, and step the sequence
 * sub-index.
 * The span is XOR-folded; any total but the genuine one advances the outer sequence phase first.
 * With play inactive a single default caption pair is posted. With play active the player caption
 * goes up (its argument one higher while the second player is up), followed by the same argument
 * under a second command when the round is armed, else by the default pair.
 * LIVE-OUT: memory only. */

import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { postCommand } from "./postCommand.js";
import { drawKillMeter } from "./drawKillMeter.js";
import { resetPlayfieldAndArmNewRound } from "./resetPlayfieldAndArmNewRound.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { PLAY_ACTIVE, ACTIVE_PLAYER, ROUND_ARMED } from "./names.js";

const GUARD_SPAN_BASE = 0x4c99;
const GUARD_SPAN_BYTES = 256;
const GUARD_GENUINE_FOLD = 0x6b;

const CAPTION_COMMAND = 2;
const DEFAULT_ARGUMENT = 2;
const PLAYER_ARGUMENT = 9;
const ARMED_COMMAND = 7;

export function loc_0774(m) {
  const { mem8 } = m;

  let fold = 0;
  for (let i = 0; i < GUARD_SPAN_BYTES; i++) fold ^= mem8[GUARD_SPAN_BASE + i];
  if (fold !== GUARD_GENUINE_FOLD) advanceSequencePhase(m);

  if (mem8[PLAY_ACTIVE] === 0) {
    postCommand(m, CAPTION_COMMAND, DEFAULT_ARGUMENT);
  } else {
    const argument = PLAYER_ARGUMENT + (mem8[ACTIVE_PLAYER] === 0 ? 0 : 1);
    postCommand(m, CAPTION_COMMAND, argument);
    if (mem8[ROUND_ARMED] === 0) postCommand(m, CAPTION_COMMAND, DEFAULT_ARGUMENT);
    else postCommand(m, ARMED_COMMAND, argument);
  }

  drawKillMeter(m);
  resetPlayfieldAndArmNewRound(m);
  advanceSequenceSubStep(m);
}
