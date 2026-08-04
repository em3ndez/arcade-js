// SPDX-License-Identifier: GPL-3.0-only
/**
 * flashEffectSpriteThenAdvanceSequence — effect-sequence step 1: a two-stage rate divider that flips a sprite-shadow
 * bit on most beats and hands the sequence to its next step on every fourth.  ROM 0x1F09.
 *
 * This is index 1 of the effect-sequence dispatch keyed on EFFECT_SEQ_STATE (the router
 * runs it while that state holds 1). It runs once per dispatch and does nothing on most
 * of them: EFFECT_SEQ_INNER counts down every call and the routine returns until it drains
 * from 1 to 0. On that beat — once every six calls — it reloads the inner counter to 6 and
 * ticks EFFECT_SEQ_OUTER:
 *
 *   - while the outer counter is still running, it flips the low bit of a sprite-shadow
 *     cell, so that bit toggles once per beat — a slow on/off flash of whatever the bit
 *     controls in the effect's sprite;
 *   - once every four beats, when the outer counter drains instead, it reloads the outer
 *     counter to 4 and advances EFFECT_SEQ_STATE by one, which moves the effect sequence on
 *     to its next step (and, at the end, re-arms the parent effect state machine).
 *
 * So across a run of dispatches the sprite bit blinks at one-sixth the dispatch rate and the
 * sequence steps forward at one-twenty-fourth of it. The inner counter is written on every
 * call (to the decremented value on a skipped call, back to 6 on a beat); the outer counter
 * is written on every beat.
 *
 * NAME: PROMOTED in understanding pass 12. Corroboration is OUTSIDE this routine: the only bytes it
 * writes are the names.js-named EFFECT_SPRITE (0x6A2C) + SPRITE_CODE field (= 0x6A2D) and EFFECT_SEQ_INNER /
 * OUTER / STATE — and that code field (0x6A2D) is [seen]-GROUNDED in names.js, observed flipping
 * 0x60<->0x61 over 41 live transitions in lockstep with EFFECT_SEQ_STATE. So the FLASH is observed
 * behaviour, not inference, which is what earns the verb. What separates it from its sibling
 * animateEffectSpriteThenRearmEffect (0x1F23) is the operation on that same byte: this one `xor 0x01`
 * OSCILLATES between two tiles on a 6-frame beat (4 pulses) and then advances the sequence, priming
 * OUTER = 4; the sibling `inc`s, marching forward through consecutive tiles.
 * WHAT THIS NAME DOES NOT CLAIM: what the effect DEPICTS on screen. The effect-sprite semantic is
 * still ungrounded (mechanisms.md §6), so the name describes the byte-level effect only.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1f09.test.js.
 * GATE:     strict, exhaustive over the reachable input space — every inner value (delay
 *           vs beat), the full outer x sprite-cell grid on the beat, and every state value
 *           on the advance beat — plus real captured attract dispatches (all three arms fire
 *           naturally in attract). A leaf: no callees.
 * LIVE-OUT: memory-only. The oracle threads flags/registers through and returns via the
 *           dispatch tail, but the caller chain (the router, then its own caller) consumes
 *           none of them — it takes an independent skip decision — so the residual is dead.
 * NAMES:    EFFECT_SEQ_INNER (0x6346), EFFECT_SEQ_OUTER (0x6347), EFFECT_SEQ_STATE (0x6345)
 *           and EFFECT_SPRITE (0x6A2C) from names.js. The flashed cell 0x6A2D is the effect sprite
 *           record's SPRITE_CODE field, reached as EFFECT_SPRITE + SPRITE_CODE per names.js.
 */

import { EFFECT_SEQ_INNER, EFFECT_SEQ_OUTER, EFFECT_SEQ_STATE, EFFECT_SPRITE, SPRITE_CODE } from "./names.js";

// The +1 SPRITE_CODE field of EFFECT_SPRITE (0x6A2C, named in names.js) — a cell inside the sprite
// shadow buffer (SPRITE_BUFFER, the block the DMA blits to sprite RAM each vblank). This routine
// flips its low bit each beat, toggling the effect sprite's tile between 0x60 and 0x61.
const EFFECT_SPRITE_CELL = EFFECT_SPRITE + SPRITE_CODE; // 0x6A2D — names.js: reach it as EFFECT_SPRITE + SPRITE_CODE

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function flashEffectSpriteThenAdvanceSequence(m) {
  const { mem } = m;

  // Inner divider: tick down on every dispatch and stop here until it drains to zero (the
  // pre-decrement value 1 is the beat; from 0 it wraps to 255 and keeps counting).
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;

  // A beat: reload the inner divider and tick the outer one.
  mem.write8(EFFECT_SEQ_INNER, 6);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;

  if (outer === 0) {
    // Fourth beat: reload the outer divider and advance the sequence to its next step.
    mem.write8(EFFECT_SEQ_OUTER, 4);
    mem.write8(EFFECT_SEQ_STATE, mem.read8(EFFECT_SEQ_STATE) + 1);
    return;
  }

  // Ordinary beat: keep the stepped outer value and flip the sprite flash bit.
  mem.write8(EFFECT_SEQ_OUTER, outer);
  mem.write8(EFFECT_SPRITE_CELL, mem.read8(EFFECT_SPRITE_CELL) ^ 0x01);
}
