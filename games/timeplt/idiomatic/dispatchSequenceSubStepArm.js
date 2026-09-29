// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequenceSubStepArm — inner level of the two-level sequence machine for the round-engine
 * mode: the low nibble of the sub-step picks one of sixteen arms out of a fixed inline word table,
 * that arm runs, then the fixed continuation every arm returns into. Each case is the slot's literal
 * target, called directly; the nibble mask means every one of the sixteen slots is reachable and
 * every one names a transcribed arm, so no index can fall off the table. No arm reads a register the
 * dispatch would have left standing — each opens on a cell read or a fixed-argument call — so the arm
 * is entered directly, with no return slot parked for it and no table word carried in on a register
 * pair. LIVE-OUT: memory, and the continuation's. */

import { SEQUENCE_SUBSTEP } from "./names.js";
import { advanceAttractTowardGameStart } from "./advanceAttractTowardGameStart.js";
import { armRoundStartThenStepSequence } from "./armRoundStartThenStepSequence.js";
import { seatCaptionPenFromEraFoldingTamperIntoPhase } from "./seatCaptionPenFromEraFoldingTamperIntoPhase.js";
import { blankCaptionThenAdvancePenRunStep } from "./blankCaptionThenAdvancePenRunStep.js";
import { loadActivePlayerContextAndPostRoundHud } from "./loadActivePlayerContextAndPostRoundHud.js";
import { postRoundStartCaptionsAndResetPlayfield } from "./postRoundStartCaptionsAndResetPlayfield.js";
import { flyRoundIntroFlashingEraYearThenEraseIntroCaptions } from "./flyRoundIntroFlashingEraYearThenEraseIntroCaptions.js";
import { flyEnemyFreeLeadInThenStepSequence } from "./flyEnemyFreeLeadInThenStepSequence.js";
import { serviceRoundThenResolvePlayerState } from "./serviceRoundThenResolvePlayerState.js";
import { fileScoreAfterGameOverHoldElsePassTurn } from "./fileScoreAfterGameOverHoldElsePassTurn.js";
import { erasePenRouteThenOpenInitialsEntry } from "./erasePenRouteThenOpenInitialsEntry.js";
import { stepHighScoreInitialsEntry } from "./stepHighScoreInitialsEntry.js";
import { loc_12e2 } from "./loc_12e2.js";
import { restartAttractSequence } from "./restartAttractSequence.js";
import { paintSelfTestScreenPhaseThenStepSequence } from "./paintSelfTestScreenPhaseThenStepSequence.js";
import { stepRoundStartIntroAnimation } from "./stepRoundStartIntroAnimation.js";
import { loc_15b5 } from "./loc_15b5.js";

// Only the low nibble picks a slot, so the table's sixteen words are the whole of the choice.
const ARM_MASK = 0x0f;

export function dispatchSequenceSubStepArm(m) {
  switch (m.mem8[SEQUENCE_SUBSTEP] & ARM_MASK) {
    // The round-start arm, the caption pen seated from the era, the caption blank and pen-run step,
    // the active player's turn set up with the round HUD, the round-start captions, the flashing era
    // year, the enemy-free lead-in, then the round engine itself; after it the post-game-over filing,
    // the pen-route erase that opens initials entry, the initials entry step, a delay countdown, the
    // attract restart, a self-test screen phase, the intro animation, and an arm that does nothing.
    case 0: armRoundStartThenStepSequence(m); break;
    case 1: seatCaptionPenFromEraFoldingTamperIntoPhase(m); break;
    case 2: blankCaptionThenAdvancePenRunStep(m); break;
    case 3: loadActivePlayerContextAndPostRoundHud(m); break;
    case 4: postRoundStartCaptionsAndResetPlayfield(m); break;
    case 5: flyRoundIntroFlashingEraYearThenEraseIntroCaptions(m); break;
    case 6: flyEnemyFreeLeadInThenStepSequence(m); break;
    case 7: serviceRoundThenResolvePlayerState(m); break;
    case 8: fileScoreAfterGameOverHoldElsePassTurn(m); break;
    case 9: erasePenRouteThenOpenInitialsEntry(m); break;
    case 10: stepHighScoreInitialsEntry(m); break;
    case 11: loc_12e2(m); break;
    case 12: restartAttractSequence(m); break;
    case 13: paintSelfTestScreenPhaseThenStepSequence(m); break;
    case 14: stepRoundStartIntroAnimation(m); break;
    case 15: loc_15b5(m); break;
  }
  advanceAttractTowardGameStart(m);
}
