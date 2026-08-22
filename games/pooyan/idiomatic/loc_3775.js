// SPDX-License-Identifier: GPL-3.0-only
import { PLAY_STATE_INDEX, ANIM_TABLE_3829, ANIM_TABLE_3847 } from "./names.js";
import { loc_3553 } from "./loc_3553.js";
import { setActorAnimation } from "./setActorAnimation.js";
/**
 * loc_3775 — end-of-move dispatch for an actor record.
 *
 * In the finish phase the slot is completed only once its move counter (rec+6) reaches zero,
 * by blanking the actor's sprite band. Outside that phase, while the counter is below two, the
 * anim latch (rec+8) is cleared and a turn-around animation is armed — one of two sequences
 * picked by bit 1 of the flag byte (rec+7). A counter of two or more, or a nonzero finish
 * counter, does nothing.
 *
 * LIVE-OUT: A = the move counter (rec+6) on every path. On the finish-and-blank path the band
 * helper also leaves HL = the advanced pointer and B = 0.
 */

const FINISH_PHASE = 0x05; // play-state value meaning "finish the slot"
const TURNAROUND_MAX = 0x02; // counter must be below this to arm the turn animation
const REC_MOVE_COUNTER = 0x06; // rec+6: down-counter gating the move's end
const REC_FLAG_BYTE = 0x07; // rec+7: bit 1 selects the turn-around sequence
const REC_ANIM_LATCH = 0x08; // rec+8: cleared before the animation is armed
const FLAG_TURN_VARIANT = 0x02; // bit 1 of the flag byte

export function loc_3775(m, rec = m.regs.ix) {
  const { mem8 } = m;
  const counter = mem8[rec + REC_MOVE_COUNTER];

  if (mem8[PLAY_STATE_INDEX] === FINISH_PHASE) {
    if (counter === 0) loc_3553(m, rec); // finish: blank the sprite band
    return (m.regs.a = counter);
  }
  if (counter >= TURNAROUND_MAX) return (m.regs.a = counter);

  mem8[rec + REC_ANIM_LATCH] = 0x00;
  const turnVariant = (mem8[rec + REC_FLAG_BYTE] & FLAG_TURN_VARIANT) !== 0;
  setActorAnimation(m, rec, turnVariant ? ANIM_TABLE_3847 : ANIM_TABLE_3829);
  return (m.regs.a = counter);
}
