// SPDX-License-Identifier: GPL-3.0-only
/** fileScoreAfterGameOverHoldElsePassTurn — hold on the sequence delay, then try to file the finished score. While the delay is
 * still counting it just ticks. When it expires and the score beats no standing record, two
 * commands are queued, the sub-step is reseated from a program byte and the turn passes on (or the
 * sequence steps). When the score was filed, a sound is requested, the pen is set to the blanking
 * glyph and armed at its route start, a fixed 256-byte program run is folded into an eight-bit total
 * -- any total but the genuine one advances the outer phase -- and the sub-step steps on.
 * LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { fileScoreIntoHighScoreTable } from "./fileScoreIntoHighScoreTable.js";
import { postCommand } from "./postCommand.js";
import { passTurnToOtherPlayerIfLivesElseStepSequence } from "./passTurnToOtherPlayerIfLivesElseStepSequence.js";
import { loc_583a } from "./loc_583a.js";
import { armThePenRouteThenColdStartOnATamperedImage } from "./armThePenRouteThenColdStartOnATamperedImage.js";
import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import {
  SEQUENCE_DELAY, SEQUENCE_SUBSTEP, PEN_COLOUR, PEN_GLYPH, SKIP_INITIALS_SUBSTEP_SEED, HIGH_SCORE_FILED_CHECKSUM_BASE,
} from "./names.js";


const UNFILED_COMMAND = 3;
const UNFILED_ARGUMENTS = [0x09, 0x0b];
const BLANKING_GLYPH = 0xf1;
const CHECKED_BYTES = 0x100;
const GENUINE_TOTAL = 0x19;

export function fileScoreAfterGameOverHoldElsePassTurn(m) {
  const { mem8 } = m;

  mem8[SEQUENCE_DELAY] = mem8[SEQUENCE_DELAY] - 1;
  if (mem8[SEQUENCE_DELAY] !== 0) return;

  const dropped = fileScoreIntoHighScoreTable(m);
  if (dropped) {
    for (const argument of UNFILED_ARGUMENTS) postCommand(m, UNFILED_COMMAND, argument);
    mem8[SEQUENCE_SUBSTEP] = mem8[SKIP_INITIALS_SUBSTEP_SEED];
    return passTurnToOtherPlayerIfLivesElseStepSequence(m);
  }

  loc_583a(m);
  mem8[PEN_COLOUR] = 0;
  mem8[PEN_GLYPH] = BLANKING_GLYPH;
  armThePenRouteThenColdStartOnATamperedImage(m);

  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = u8(total + mem8[u16(HIGH_SCORE_FILED_CHECKSUM_BASE + i)]);
  if (total !== GENUINE_TOTAL) advanceSequencePhase(m);
  return advanceSequenceSubStep(m);
}
