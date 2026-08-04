// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchEffectSequenceStep — the router for the effect-sequence step machine held in
 * EFFECT_SEQ_STATE.
 *
 * Runs once per frame while the effect is armed. It reads the step byte and hands the frame to
 * that step's handler, writing nothing of its own — pure control flow over a three-step sequence
 * that each handler walks forward:
 *
 *   - step 0 — the one-shot that consumes the collision record, builds the effect sprite, fires
 *     its priority sound, and advances the sequence to step 1.
 *   - step 1 — the two-stage rate divider that flashes the effect sprite's tile between two codes
 *     and, after four beats, advances to step 2.
 *   - step 2 — the two-stage rate divider that marches the sprite's tile forward and, when it runs
 *     out, resets the sequence to step 0 and re-arms the parent effect state machine.
 *
 * So the reachable state space is exactly {0, 1, 2}: step 0 is entered on a fresh effect, each
 * handler advances the state, and step 2's teardown returns it to 0.
 *
 * TABLE ALIASING. The step index is doubled to reach a two-byte table slot, and that doubling is
 * taken at eight bits, so a state and that state plus 128 land on the same slot — 128, 129 and 130
 * alias steps 0, 1 and 2. That is why the step is selected by the low seven bits here. Nothing
 * writes a state that high (the counters only ever produce 0-2), so the aliases are unreachable
 * in play, but the selection is faithful to the hardware.
 *
 * Any other state indexes past the three-entry table into whatever follows it and transfers to a
 * garbage address; that is surfaced as a loud error rather than executed.
 *
 * LIVE-OUT: memory-only. Every visible byte is the chosen handler's — the step selector, the two
 * divider counters, the effect sprite record, the effect sound, and on teardown the parent effect
 * state and its parameter pointer; this routine writes none itself. The return value is undefined
 * on every path, the caller discards it and takes its own skip decision, and no register or flag
 * is consumed either.
 */

import { EFFECT_SEQ_STATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { buildEffectSprite } from "./buildEffectSprite.js";
import { flashEffectSpriteThenAdvanceSequence } from "./flashEffectSpriteThenAdvanceSequence.js";
import { animateEffectSpriteThenRearmEffect } from "./animateEffectSpriteThenRearmEffect.js";

// The effect sequence's three steps, indexed by EFFECT_SEQ_STATE. Any index past the end runs off
// the table and is refused below.
const STEPS = [
  buildEffectSprite, // step 0 — build the effect sprite, cue its sound, advance to step 1
  flashEffectSpriteThenAdvanceSequence, // step 1 — flash the tile, advance to step 2 after four beats
  animateEffectSpriteThenRearmEffect, // step 2 — march the tile, then tear down and re-arm
];

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function dispatchEffectSequenceStep(m) {
  const state = m.mem.read8(EFFECT_SEQ_STATE);

  // Only the low seven bits reach the table — the slot arithmetic wraps at eight bits, so
  // state and state+128 select the same step (see TABLE ALIASING above).
  const step = STEPS[state & 0x7f];
  if (step) return step(m);

  throw new NotImplemented(
    `dispatchEffectSequenceStep: EFFECT_SEQ_STATE (0x6345) step ${state} runs off the end of the three-entry step ` +
      `table and transfers to a garbage address; only steps 0-2 (and their +128 aliases) exist.`,
  );
}
