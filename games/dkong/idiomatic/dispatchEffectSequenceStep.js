// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchEffectSequenceStep — the router for the effect-sequence step machine held in EFFECT_SEQ_STATE (0x6345).
 * ROM 0x1E96.
 *
 * Reached once per frame from the still-oracle head loc_1e8c, which runs it only while the
 * effect is armed. It reads EFFECT_SEQ_STATE and hands the frame to that step's handler,
 * writing nothing of its own — pure control flow over a three-step sequence that each handler
 * walks forward:
 *
 *   - step 0 -> buildEffectSprite: the one-shot that consumes the collision record, builds the
 *     effect sprite, fires its priority sound, and advances the sequence to step 1.
 *   - step 1 -> flashEffectSpriteThenAdvanceSequence: the two-stage rate divider that flashes
 *     the effect sprite's tile between two codes and, after four beats, advances to step 2.
 *   - step 2 -> animateEffectSpriteThenRearmEffect: the two-stage rate divider that marches the
 *     sprite's tile forward and, when it runs out, resets the sequence to step 0 and re-arms
 *     the parent effect state machine.
 *
 * So the reachable state space is exactly {0, 1, 2}: step 0 is entered on a fresh effect, each
 * handler advances the state, and step 2's teardown returns it to 0.
 *
 * TABLE ALIASING. The step index is doubled to reach the two-byte table slot, and that doubling
 * is taken at eight bits, so a state and that state plus 128 land on the same slot — 128, 129
 * and 130 alias steps 0, 1 and 2. That is why the step is selected by the low seven bits here.
 * Nothing writes a state that high (the counters only ever produce 0-2), so the aliases are
 * unreachable in play, but they are faithful to the oracle and the equivalence sweep covers all
 * 256 states, which is what keeps the seven-bit selection honest rather than decorative.
 *
 * Any other state indexes past the three-entry table into whatever ROM follows it and transfers
 * to a garbage address; like the oracle, that is surfaced as a loud error rather than executed.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e96.test.js.
 * GATE:     strict — REACHABLE NATURALLY, no crafting needed for coverage: hooking 0x1E96 in a
 *           plain attract run captures 584 real dispatches in 8000 frames and they span every
 *           reachable step (8 at step 0, 240 at step 1, 336 at step 2). Each captured entry is
 *           replayed oracle-vs-idiomatic on FRESH clones (the handlers write memory and the
 *           step-0 arm cues a sound) and compared on RAM - STACK_SCRATCH plus the return value.
 *           On top of that an EXHAUSTIVE sweep pokes all 256 states identically onto two real
 *           bases — covering the three live steps, the three aliases, and all 250 out-of-table
 *           states, where both sides must throw and must leave identical RAM. Two bases because
 *           steps 1 and 2 are indistinguishable off a beat (both merely tick the fast divider
 *           down), so the sweep also runs from a captured beat entry where they diverge.
 *           Three teeth: a dropped step-0 one-shot, steps 1 and 2 swapped on a beat entry, and
 *           the alias selection dropped — each caught, at a named cell.
 * LIVE-OUT: memory-only. Every visible byte is the chosen handler's (EFFECT_SEQ_STATE /
 *           EFFECT_SEQ_INNER / EFFECT_SEQ_OUTER, the effect sprite record, the effect sound,
 *           and on teardown EFFECT_STATE / EFFECT_PARAM_PTR); this routine writes none itself.
 *           The return value is undefined on every path on both sides — all three handlers
 *           return nothing and loc_1e8c discards the result, taking its own skip decision — and
 *           no register or flag is consumed either. SP/pc are the dropped stack model: the
 *           oracle's table walk and return chain move them inside STACK_SCRATCH, dead either way.
 * NAMES:    EFFECT_SEQ_STATE (0x6345) from ram.js — the step selector, whose ram.js note already
 *           records this routine as its router. No other cell is touched here.
 */

import { EFFECT_SEQ_STATE } from "./ram.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { buildEffectSprite } from "./buildEffectSprite.js"; // ROM 0x1EA0 — step 0
import { flashEffectSpriteThenAdvanceSequence } from "./flashEffectSpriteThenAdvanceSequence.js"; // ROM 0x1F09 — step 1
import { animateEffectSpriteThenRearmEffect } from "./animateEffectSpriteThenRearmEffect.js"; // ROM 0x1F23 — step 2

// The effect sequence's three steps, indexed by EFFECT_SEQ_STATE (0x6345). Any index past the
// end runs off the table and is refused below.
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
