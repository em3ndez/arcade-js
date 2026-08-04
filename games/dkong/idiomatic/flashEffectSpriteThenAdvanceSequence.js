// SPDX-License-Identifier: GPL-3.0-only
/**
 * flashEffectSpriteThenAdvanceSequence — effect-sequence step 1: a two-stage rate divider that flips a sprite-shadow
 * bit on most beats and hands the sequence to its next step on every fourth.
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
 * THE FLASH IS OBSERVED, not inferred: the flipped cell is the effect sprite's own tile-code
 * byte, and in a running game it is seen alternating between two consecutive tile codes in
 * lockstep with the sequence state. What separates this step from the neighbouring one that
 * touches the same byte is the operation: this one XORs the low bit, so the tile OSCILLATES
 * between two codes on a 6-frame beat (four pulses) before the sequence advances with the
 * outer divider primed back to 4; the other increments, marching forward through consecutive
 * tiles instead.
 *
 * WHAT THIS NAME DOES NOT CLAIM: what the effect DEPICTS on screen. That is not established,
 * so the name describes the byte-level effect only.
 *
 * LIVE-OUT: memory-only — the two dividers, the sequence state, and the flashed sprite cell.
 */

import { EFFECT_SEQ_INNER, EFFECT_SEQ_OUTER, EFFECT_SEQ_STATE, EFFECT_SPRITE, SPRITE_CODE } from "./names.js";

// The effect sprite record's tile-code field: a cell inside the sprite shadow buffer, the
// block the DMA blits to sprite RAM each vblank. This routine flips its low bit each beat,
// toggling the effect sprite's tile between 0x60 and 0x61.
const EFFECT_SPRITE_CELL = EFFECT_SPRITE + SPRITE_CODE;

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
