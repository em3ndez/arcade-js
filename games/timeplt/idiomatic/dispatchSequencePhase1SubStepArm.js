// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequencePhase1SubStepArm — inner level of the two-level sequence machine for one outer
 * mode: the sub-step index picks one arm from a fixed inline word table, that arm runs, then this
 * mode's shared tail. Each case is the slot's literal target, called directly. The index is RAW; the
 * entry doubling wraps at eight bits, so index and index+128 pick the same slot (low seven bits key
 * the switch). Thirteen slots are transcribed arms; a higher index addresses bytes that carry no
 * routine, so reaching one is a fault and it is raised, not assumed away. No arm reads a register the
 * dispatch would have left standing — each opens on a cell read or a fixed-argument call — so the arm
 * is entered directly, with no table word carried in on a register pair. LIVE-OUT: memory, and the
 * shared tail's. */

import { NotImplemented } from "../../../boards/timeplt/io.js";
import { SEQUENCE_SUBSTEP } from "./names.js";
import { advanceSequenceElseStartFreePlayGame } from "./advanceSequenceElseStartFreePlayGame.js";
import { erasePenRouteThenAdvanceStep } from "./erasePenRouteThenAdvanceStep.js";
import { advancePenRunAnimationStep } from "./advancePenRunAnimationStep.js";
import { showCreditLine } from "./showCreditLine.js";
import { buildCopyrightScreenThenVerifyImage } from "./buildCopyrightScreenThenVerifyImage.js";
import { holdCopyrightThenEraseTheCoinInvitation } from "./holdCopyrightThenEraseTheCoinInvitation.js";
import { paintReadoutsThenSampleWitnessOrDerail } from "./paintReadoutsThenSampleWitnessOrDerail.js";
import { holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail } from "./holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail.js";
import { guardBlockOrBlankDisplay } from "./guardBlockOrBlankDisplay.js";
import { guardBlockOrDerailSequence } from "./guardBlockOrDerailSequence.js";
import { foldImageBlockIntoSignatureThenAdvanceSequence } from "./foldImageBlockIntoSignatureThenAdvanceSequence.js";
import { stepSequenceUnderChecksum } from "./stepSequenceUnderChecksum.js";
import { trampolineToAdvanceSequenceSubStep } from "./trampolineToAdvanceSequenceSubStep.js";
import { verifyImageSignatureThenStartAttractDemoOrDerail } from "./verifyImageSignatureThenStartAttractDemoOrDerail.js";

// The doubling that reaches a two-byte entry wraps at eight bits, so only the low seven bits of the
// index can pick a slot: index and index+128 land on the same word.
const ENTRY_MASK = 0x7f;

export function dispatchSequencePhase1SubStepArm(m) {
  const entry = m.mem8[SEQUENCE_SUBSTEP] & ENTRY_MASK;
  switch (entry) {
    // The tamper-check / copyright / attract sequence, in order: erase the pen route, animate the pen
    // run, show the credit line, build the copyright screen, hold it and erase the coin invitation,
    // paint the readouts and sample the witness, hold and verify the glyph, two guard-block steps, fold
    // the image block into the signature, step under the checksum, a bare trampoline step, and finally
    // verify the signature and start the attract demo. Each arm returns, then the shared tail runs.
    case 0: erasePenRouteThenAdvanceStep(m); break;
    case 1: advancePenRunAnimationStep(m); break;
    case 2: showCreditLine(m); break;
    case 3: buildCopyrightScreenThenVerifyImage(m); break;
    case 4: holdCopyrightThenEraseTheCoinInvitation(m); break;
    case 5: paintReadoutsThenSampleWitnessOrDerail(m); break;
    case 6: holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail(m); break;
    case 7: guardBlockOrBlankDisplay(m); break;
    case 8: guardBlockOrDerailSequence(m); break;
    case 9: foldImageBlockIntoSignatureThenAdvanceSequence(m); break;
    case 10: stepSequenceUnderChecksum(m); break;
    case 11: trampolineToAdvanceSequenceSubStep(m); break;
    case 12: verifyImageSignatureThenStartAttractDemoOrDerail(m); break;
    // A higher index addresses bytes this port has not transcribed as routines; the inline dispatch
    // would jump into them and fault before ever reaching the tail, so surface the same fault here.
    default:
      throw new NotImplemented(`dispatchSequencePhase1SubStepArm: phase-1 sub-step arm ${entry} is not a transcribed routine`);
  }
  return advanceSequenceElseStartFreePlayGame(m);
}
