// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateEffectSpriteThenRearmEffect — effect-sequence step 2: a two-stage rate divider that steps the effect sprite's
 * tile on most beats and, when it runs out, resets the sequence and re-arms the parent effect.
 * ROM 0x1F23.
 *
 * This is index 2 of the effect-sequence dispatch keyed on EFFECT_SEQ_STATE (the router runs it
 * while that state holds 2). Like its sibling step 1 it runs once per dispatch and does nothing on
 * most of them: EFFECT_SEQ_INNER counts down every call and the routine returns until it drains
 * from 1 to 0. On that beat — once every twelve calls — it reloads the inner counter to 12 and
 * ticks EFFECT_SEQ_OUTER down:
 *
 *   - while the outer counter is still running, it increments the effect sprite's code byte, so
 *     the sprite's tile marches forward one step per beat (an animation, as opposed to step 1's
 *     two-tile flash);
 *   - once the outer counter drains, it does NOT reload it; instead it tears the sequence down —
 *     resets EFFECT_SEQ_STATE back to 0, re-arms the parent effect state machine (EFFECT_STATE = 1
 *     with its param pointer aimed back at the effect sprite record base), and clears a shared
 *     scratch cell. That re-arm hands the whole transient effect back to its state machine to run
 *     again from the top.
 *
 * So across a run of dispatches the sprite tile advances at one-twelfth the dispatch rate, and
 * after the outer counter's worth of steps the effect restarts. The inner counter is written on
 * every call (the decremented value on a skipped call, back to 12 on a beat); the outer counter is
 * written on every beat (its decremented value — never reloaded here).
 *
 * NAME: PROMOTED in understanding pass 12. Corroboration is OUTSIDE this routine: it drives the same
 * ram.js-named EFFECT_SPRITE (0x6A2C) code byte as its sibling, and that byte (0x6A2D) is [seen]-
 * GROUNDED in ram.js (observed stepping live, 41 transitions, tied to EFFECT_SEQ_STATE). The name
 * records the two things that distinguish it from flashEffectSpriteThenAdvanceSequence (0x1F09):
 * this one `inc`s — MARCHING forward through consecutive tiles on a 12-frame beat, 3 steps, never
 * reloading OUTER — and then TEARS THE EFFECT DOWN, clearing 0x6350, the byte runHitEffectInsteadOfPlay reads to
 * caller-skip the whole per-frame cascade. So this is the arm that hands play back, hence "rearm".
 * WHAT THIS NAME DOES NOT CLAIM: what the effect DEPICTS. That semantic is still ungrounded
 * (mechanisms.md §6); the name describes the byte-level effect and the teardown, nothing more.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1f23.test.js.
 * GATE:     strict, exhaustive over the reachable input space by factorisation — every inner value
 *           (delay vs beat), every outer value on the beat (step vs reset), and every sprite-code
 *           value on the step beat — plus real captured attract dispatches (all three arms fire
 *           naturally in attract). A leaf: no callees.
 * LIVE-OUT: memory-only. The oracle threads flags/registers through and returns via the dispatch
 *           tail, but the caller chain (the router, then its own caller) consumes none of them — it
 *           takes an independent skip decision — so the residual is dead.
 * NAMES:    EFFECT_SEQ_INNER (0x6346), EFFECT_SEQ_OUTER (0x6347), EFFECT_SEQ_STATE (0x6345),
 *           EFFECT_STATE (0x6340), EFFECT_PARAM_PTR (0x6343), EFFECT_SPRITE (0x6A2C) and its +1
 *           SPRITE_CODE field (0x6A2D) — all from ram.js. 0x6350 is genuinely-unnamed shared engine
 *           scratch (shared across subsystems, no grounded name fits) — kept hex.
 */

import {
  EFFECT_SEQ_INNER,
  EFFECT_SEQ_OUTER,
  EFFECT_SEQ_STATE,
  EFFECT_STATE,
  EFFECT_PARAM_PTR,
  EFFECT_SPRITE,
  SPRITE_CODE,
} from "./ram.js";

// The +1 code field of the effect sprite record (0x6A2D), inside the sprite shadow buffer the DMA
// blits to sprite RAM each vblank. This routine increments it each beat, stepping the sprite's tile.
const EFFECT_SPRITE_CELL = EFFECT_SPRITE + SPRITE_CODE; // 0x6A2D

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
    mem.write8(0x6350, 0); // shared engine scratch (unnamed) cleared alongside the reset
    mem.write8(EFFECT_STATE, 1); // re-arm the parent effect state machine
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE); // param pointer back to the effect sprite record base
    return;
  }

  // Ordinary beat: step the effect sprite's tile forward by one.
  mem.write8(EFFECT_SPRITE_CELL, mem.read8(EFFECT_SPRITE_CELL) + 1);
}
