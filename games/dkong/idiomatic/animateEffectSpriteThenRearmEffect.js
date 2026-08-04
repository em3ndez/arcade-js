// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateEffectSpriteThenRearmEffect — step 2 of the effect sequence: a two-stage rate divider
 * that steps the effect sprite's tile on most beats and, when it runs out, resets the sequence
 * and re-arms the parent effect.
 *
 * The effect-sequence router runs this while the sequence state holds its index. Like the step
 * before it, it runs once per dispatch and does nothing on most of them: an inner counter ticks
 * down every call and the routine returns until that counter drains to zero. On that beat —
 * once every twelve calls — it reloads the inner counter and ticks an outer counter down:
 *
 *   - while the outer counter is still running, it increments the effect sprite's code byte, so
 *     the sprite's tile MARCHES forward one step per beat. That is what distinguishes this step
 *     from its sibling, which flashes between two tiles instead;
 *   - once the outer counter drains it does NOT reload it. Instead it tears the sequence down:
 *     resets the sequence state to the start, re-arms the parent effect state machine with its
 *     parameter pointer aimed back at the effect sprite record, and clears a shared engine
 *     scratch cell. Clearing that cell is what hands the per-frame cascade back to ordinary
 *     play, since a routine upstream reads it to skip the whole cascade while an effect runs.
 *
 * So across a run of dispatches the sprite tile advances at one-twelfth the dispatch rate, and
 * after the outer counter's worth of steps the effect restarts from the top. The inner counter
 * is written on every call — the decremented value on a skipped call, the full reload on a beat
 * — and the outer counter on every beat, always its decremented value.
 *
 * WHAT THIS DOES NOT CLAIM: what the effect DEPICTS on screen. What is established is the
 * byte-level animation and the teardown, and nothing above that.
 *
 * A LEAF: no callees.
 *
 * Reads: the two counters and the effect sprite's code byte. Writes: the two counters, the
 * sprite's code byte on an ordinary beat, and on the final beat the sequence state, the parent
 * effect state, its parameter pointer and the shared scratch cell.
 *
 * LIVE-OUT: memory-only. The router takes its own skip decision and consumes nothing this
 * routine leaves in a register.
 */

import {
  EFFECT_SEQ_INNER,
  EFFECT_SEQ_OUTER,
  EFFECT_SEQ_STATE,
  EFFECT_STATE,
  EFFECT_PARAM_PTR,
  EFFECT_SPRITE,
  SPRITE_CODE,
} from "./names.js";

// The code field of the effect sprite's record, in the shadow buffer that is blitted to sprite
// memory each vblank. This routine increments it each beat, stepping the sprite's tile.
const EFFECT_SPRITE_CELL = EFFECT_SPRITE + SPRITE_CODE;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function animateEffectSpriteThenRearmEffect(m) {
  const { mem } = m;

  // Inner divider: tick down on every dispatch and stop here until it drains to zero (the
  // pre-decrement value 1 is the beat; from 0 it wraps to 255 and keeps counting).
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;

  // A beat: reload the inner divider and tick the outer one down (kept, not reloaded here).
  mem.write8(EFFECT_SEQ_INNER, 12);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);

  if (outer === 0) {
    // Final beat: tear the sequence down and re-arm the parent effect to run from the top.
    mem.write8(EFFECT_SEQ_STATE, 0); // back to the start of the effect-sequence dispatch
    mem.write8(0x6350, 0); // the shared engine scratch that gates the per-frame cascade
    mem.write8(EFFECT_STATE, 1); // re-arm the parent effect state machine
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE); // param pointer back to the sprite record base
    return;
  }

  // Ordinary beat: step the effect sprite's tile forward by one.
  mem.write8(EFFECT_SPRITE_CELL, mem.read8(EFFECT_SPRITE_CELL) + 1);
}
