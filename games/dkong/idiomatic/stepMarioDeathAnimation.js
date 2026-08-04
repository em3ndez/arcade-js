// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMarioDeathAnimation — the cycling arm of Mario's DEATH ANIMATION: on each 8-frame gate
 * tick step his sprite to the next of four orientations, and when the thirteen ticks run out
 * settle it and advance the phase.
 *
 * One of three arms of the death-animation phase machine. The arm before it seeds the animation
 * and the thirteen-tick count, this one runs the cycle, and the arm after it hands off to the
 * life-loss sub-state. It is gated by the sub-state timer, so it acts only on the frames that
 * gate expires:
 *
 *   - The shared countdown helper ticks the sub-state timer. While it is still counting the arm
 *     is skipped this frame. On expiry the timer is reloaded to 8 — the fixed eight-frame tick
 *     cadence.
 *   - Decrement the animation's tick counter. If it has NOT reached zero, step Mario's sprite
 *     record: flip bit 0 of the sprite-code byte every tick, so the tile alternates between two
 *     codes, and on the tick that bit 0 falls back to 0 also flip bit 7 of the sprite-code byte
 *     and bit 7 of the attribute byte. Those two bits are the vertical and horizontal mirror
 *     flags, so flipping them together is a 180-degree ROTATION.
 *   - When the count reaches zero, advance instead: rewrite the sprite-code byte to a fixed
 *     settle tile, preserving its old mirror bit, bump the phase on by one, and reload the gate
 *     long — 128 ticks — so the next arm fires only after a pause.
 *
 * OBSERVED SHAPE. Across many completed episodes the tick counter steps 13, 12, … 0, one per
 * eight-frame gate tick, and Mario's record takes exactly four (code, attribute) pairs, each
 * held eight frames and cycled three times, before the settle write lands its fixed tile. The
 * episode this arm dominates ends with a life lost in the following sub-state. In ordinary
 * play, with the animation idle, neither the phase nor the tick counter ever moves.
 *
 * WHAT THE NAME DOES NOT CLAIM. It does not claim a cause: the animation is not conditional on
 * Mario being inactive, and the bonus-timer-expiry death reaches these same instructions with
 * him still active, by jumping into the middle of them and stepping over that test. It makes NO
 * PIXEL CLAIM — what is established is the four (code, attribute) pairs and the settle byte,
 * not how the orientation cycle looks on screen or what any of those tiles depict. And it does
 * not claim to end the life; the next arm hands that to the following sub-state.
 *
 * Reads: the sub-state timer, the tick counter, the phase, and Mario's sprite code and
 * attribute. Writes: all of those.
 *
 * LIVE-OUT: memory-only. The dispatcher above it reads none of its registers.
 */

import { SUBSTATE_TIMER, MARIO_SPRITE_RECORD, DEATH_ANIM_PHASE, DEATH_ANIM_TICKS_LEFT } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

// The two animated cells of Mario's hardware sprite record: the sprite-code byte, whose bit 7
// is the vertical mirror flag, and the attribute byte, whose bit 7 is the horizontal one.
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1;
const SPRITE_ATTR = MARIO_SPRITE_RECORD + 2;

export function stepMarioDeathAnimation(m) {
  const { mem } = m;

  // Gate: until the sub-state timer expires this frame, skip the arm entirely.
  if (!tickSubstateTimer(m)) return;

  // Gate expired -> reload it to the 8-frame tick cadence.
  mem.write8(SUBSTATE_TIMER, 0x08);

  // Count down the thirteen ticks; a zero result means the cycle is over.
  const remaining = (mem.read8(DEATH_ANIM_TICKS_LEFT) - 1) & 0xff;
  mem.write8(DEATH_ANIM_TICKS_LEFT, remaining);
  if (remaining === 0) {
    advancePhase(m);
    return;
  }

  // --- step: advance the sprite to the next orientation ---
  // The sprite-code byte's bit 0 flips every tick, alternating the tile. The mask carries that
  // flip in bit 0 (always set) and the code's OLD bit 0 in bit 7, so exclusive-ORing it into
  // the code toggles bit 0 always, and the vertical mirror flag only on the tick bit 0 falls
  // back to 0.
  const code = mem.read8(SPRITE_CODE);
  const b = ((code & 0x01) << 7) | 0x01; // top bit set only when the old bit 0 was set
  mem.write8(SPRITE_CODE, b ^ code);
  // The attribute byte's horizontal mirror flag flips on that same tick, so the two mirror
  // flags always swap together — the 180-degree half of the four-orientation cycle.
  mem.write8(SPRITE_ATTR, (b & 0x80) ^ mem.read8(SPRITE_ATTR));
}

/**
 * The phase-advance tail, reached only when the tick count hits zero — the SETTLE: the animation
 * stops cycling and Mario's sprite is left on one fixed tile, with its mirror flag preserved.
 * Reachable solely from this file's advance branch, so it stays a private helper rather than an
 * export.
 */
function advancePhase(m) {
  const { mem } = m;

  // Rewrite the sprite-code byte to the settle tile, keeping its old top bit — the vertical
  // mirror flag — so Mario settles facing the way he was.
  const code = mem.read8(MARIO_SPRITE_RECORD + 1);
  mem.write8(MARIO_SPRITE_RECORD + 1, (code & 0x80) | 0x7a);

  // Advance the phase by one and re-arm the gate long (128 ticks) so the next arm waits.
  mem.write8(DEATH_ANIM_PHASE, (mem.read8(DEATH_ANIM_PHASE) + 1) & 0xff);
  mem.write8(SUBSTATE_TIMER, 0x80);
}
