// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { armEnemyTurnAnimation } from "./armEnemyTurnAnimation.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import {
  loc_8d45,
  ANIM_SEQ_TABLE_1557,
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD2_VALUE,
  SUBSTATE_FIELD3_VRAM_ALT,
  SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT,
} from "./names.js";

/**
 * armEnemyState8AnimationAndTallyHudField
 * ═══════════════════════════════════════
 *
 * WHAT IT IS
 *   One of the per-actor-record state handlers that the enemy-record sweep fans out to. The
 *   game keeps every launch/hunter enemy in a 0x18-byte record; the sweep visits each live
 *   record once a frame and routes it to the handler for its current sub-state (the record's
 *   +0x02 byte). This is the handler for that sub-state: it arms the actor's animation, tallies
 *   one bit of the level indicator into the HUD's packed field, then paces the actor forward
 *   through the next couple of sub-states before it is finally blanked off the screen.
 *
 * ROLE IN THE MACHINE
 *   Two jobs share this handler. First, ANIMATION: it chooses one of four animation sequences
 *   for the actor and installs it, then steps that animation frame by frame on a countdown.
 *   Second, HUD TALLY: on the countdown's expiry it folds the level into the shared packed
 *   field SUBSTATE_FIELD3_VALUE and paints that field, doubled, as a stacked-BCD number in the
 *   status panel — the same third-field digit column the main-loop bonus/round HUD script uses.
 *   When the actor's phase field marks it as the last (phase 7) it hands off to the turn-around
 *   animation; otherwise it advances one more sub-state and, once that final tick expires,
 *   blanks the actor's sprite band.
 *
 * ROM ADDRESS
 *   0x14dc-0x1554.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT (memory only — no register result the caller reads):
 *   • the record's own fields — +0x02 sub-state index, +0x11 countdown, +0x13 turn store, and
 *     (on the retire path) its blanked sprite band;
 *   • the shared HUD packed field SUBSTATE_FIELD3_VALUE (0x8f60) and its neighbour counter
 *     SUBSTATE_FIELD2_VALUE (0x8f5e);
 *   • the status-panel digit cells SUBSTATE_FIELD3_VRAM_ALT (0x85c9) and its hundreds cell
 *     SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT (0x85e9).
 */

// ── Record field offsets (each actor lives in a 0x18-byte record; these are byte positions
//    inside it, the same layout every sweep that visits the record agrees on) ──
const REC_STATE = 0x02; //   sub-state index
const REC_COUNTDOWN = 0x11; // frame/timer countdown
const REC_SELECT = 0x12; //  animation-select field
const REC_TURN = 0x13; //    turn/select store
const REC_PHASE = 0x16; //   phase field (7 => turn animation)
const REC_INDEX = 0x17; //   default animation index
const LEVEL_MAX = 0x04; //   level clamp ceiling
const LONG_COUNT = 0x38; //  masked-path countdown

export function armEnemyState8AnimationAndTallyHudField(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // ── Pick a default animation index and a short countdown ──
  // The plain case is a one-frame countdown and the record's own stored animation index
  // (+0x17). The level test below can override both.
  let count = 0x01;
  let animIndex = mem8[rec + REC_INDEX];
  const level = mem8[loc_8d45];

  // ── When a level is live, fold the level into the animation choice and the HUD tally ──
  // A zero level (attract / idle) skips this whole block, leaving the plain defaults above.
  if (level !== 0) {
    // The select field (+0x12) doubles as a sentinel: 0xff means "no level fold". Reading it
    // and adding one lands on 0 exactly when it was 0xff.
    const bumped = (mem8[rec + REC_SELECT] + 1) & 0xff;
    if (bumped === 0) {
      animIndex = bumped; // select was 0xff -> index 0
    } else {
      // Clamp the level to at most 4 (the animation table has four entries) and use one below
      // it as the animation index.
      const clamped = level < 0x05 ? level : LEVEL_MAX;
      animIndex = clamped - 1;
      // Fold a single level bit (1 << (level-1)) into the shared packed field 0x8f60 and bump
      // its neighbour counter 0x8f5e. Those two cells feed the third BCD field of the round/bonus
      // HUD; each pass through this handler contributes one more bit to the on-screen tally.
      const mask = 1 << (clamped - 1);
      mem8[SUBSTATE_FIELD3_VALUE] = mem8[SUBSTATE_FIELD3_VALUE] + mask;
      mem8[SUBSTATE_FIELD2_VALUE] = mem8[SUBSTATE_FIELD2_VALUE] + 1;
      // The level-fold path holds the animation on screen far longer (0x38 frames).
      count = LONG_COUNT;
    }
  }

  // ── Install the chosen animation sequence and advance the sub-state ──
  // Seat the countdown into +0x11, look the chosen sequence pointer out of the 4-entry
  // little-endian table at ANIM_SEQ_TABLE_1557 (0x1557), install it into the record, then step
  // the record's sub-state index (+0x02) so the next frame dispatches to the following state.
  mem8[rec + REC_COUNTDOWN] = count;
  const animPtr = fetchWordFromTableIndex(m, animIndex, ANIM_SEQ_TABLE_1557);
  setActorAnimation(m, rec, animPtr);
  mem8[rec + REC_STATE] = mem8[rec + REC_STATE] + 1;

  // ── Per-frame body: step the animation, tick the countdown; keep going while it runs ──
  // Advance the actor's animation one frame, then drain the +0x11 countdown. While it is still
  // non-zero the actor just keeps animating in place, so this returns and the sweep moves on.
  advanceObjectAnimationFrame(m, rec);
  mem8[rec + REC_COUNTDOWN] = mem8[rec + REC_COUNTDOWN] - 1;
  if (mem8[rec + REC_COUNTDOWN] !== 0) return;

  // ── Countdown expired: paint the packed field as a stacked-BCD HUD number ──
  // Double the packed field 0x8f60 (an 8-bit shift, so it wraps mod 256) and, when the result
  // is non-zero, convert it to packed BCD and paint it as stacked digits at the status-panel
  // column 0x85c9. A three-digit result additionally lands its hundreds digit in the cell one
  // row up (0x85e9).
  const doubled = (mem8[SUBSTATE_FIELD3_VALUE] << 1) & 0xff;
  if (doubled !== 0) {
    const { a: digits, hundreds } = binToPackedBcd(m, doubled);
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT] = hundreds;
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM_ALT, digits);
  }

  // ── Last actor (phase 7): hand off to the turn-around animation and finish ──
  // The phase field (+0x16) counts the actors; the terminal value 7 diverts this record into
  // the turn animation instead of the retire path below.
  const phase = mem8[rec + REC_PHASE];
  if (phase === 0x07) return armEnemyTurnAnimation(m, rec);

  // ── Otherwise: advance one more sub-state toward retirement ──
  // Store the bumped phase into the turn field (+0x13), load a one-frame countdown, and step
  // the sub-state (+0x02) again so the record reaches the retire tick immediately below.
  mem8[rec + REC_TURN] = phase + 1;
  mem8[rec + REC_COUNTDOWN] = 0x01;
  mem8[rec + REC_STATE] = mem8[rec + REC_STATE] + 1;

  // ── Retire tick: one last animation frame, then blank the actor's sprite band ──
  // Step the animation once more and drain the just-loaded one-frame countdown. On its expiry
  // the actor is done: blank its sprite band so it disappears from the screen.
  advanceObjectAnimationFrame(m, rec);
  mem8[rec + REC_COUNTDOWN] = mem8[rec + REC_COUNTDOWN] - 1;
  if (mem8[rec + REC_COUNTDOWN] !== 0) return;
  return blankActorSpriteBand(m, rec);
}
