// SPDX-License-Identifier: GPL-3.0-only
/** flyEnemyFreeLeadInThenStepSequence — a round-engine sequence arm. Folds a 256-byte program block into SEQUENCE_PHASE (a
 * subtract-fold closed by a fixed XOR, net zero on a genuine image), runs the per-frame round
 * services, then counts SEQUENCE_DELAY down. While the delay is still running it stops there; once it
 * reaches zero it folds a second program block into SEQUENCE_PHASE the same way and steps the
 * sequence sub-step. LIVE-OUT: memory (registers and the dead stack scratch aside). */

import { multiplexSpriteSlotsSkipping } from "./multiplexSpriteSlotsSkipping.js";
import { dispatchPlayerFrameByState } from "./dispatchPlayerFrameByState.js";
import { runSceneryForEra } from "./runSceneryForEra.js";
import { fireAndSweepPlayerShots } from "./fireAndSweepPlayerShots.js";
import { multiplexSpriteSlots } from "./multiplexSpriteSlots.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8 } from "../../../core/int.js";
import { SEQUENCE_DELAY, SEQUENCE_PHASE, loc_0831, loc_12a7 } from "./names.js";

// The two program blocks folded into the phase.
const FOLD_LENGTH = 256;

/** Subtract every byte of one block from SEQUENCE_PHASE, close with the block's XOR key, store it back. */
function foldIntoPhase(m, base, key) {
  const { mem8 } = m;
  let sum = mem8[SEQUENCE_PHASE];
  for (let i = 0; i < FOLD_LENGTH; i++) sum = u8(sum - mem8[base + i]);
  mem8[SEQUENCE_PHASE] = sum ^ key;
}

export function flyEnemyFreeLeadInThenStepSequence(m) {
  const { mem8 } = m;
  // This callee returns through a stack word, so the call site supplies one; the value is a filler.
  const spriteFixup = () => { m.push16(0); multiplexSpriteSlotsSkipping(m); };

  foldIntoPhase(m, loc_0831, 0xc2);

  spriteFixup();
  dispatchPlayerFrameByState(m);
  spriteFixup();
  runSceneryForEra(m);
  fireAndSweepPlayerShots(m);
  multiplexSpriteSlots(m);

  const delay = u8(mem8[SEQUENCE_DELAY] - 1);
  mem8[SEQUENCE_DELAY] = delay;
  if (delay !== 0) return;

  foldIntoPhase(m, loc_12a7, 0x59);
  return advanceSequenceSubStep(m);
}
