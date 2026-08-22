// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { WAVE_ARRIVAL_COUNTER, FORMATION_SPAWN_TIMER, ANIM_SEQ_2D5D } from "./names.js";
/**
 * loc_2be5 — try to launch one formation slot from the record at `rec`.
 *
 * If the activity word (rec+0 OR rec+1) has bit0 set the slot is busy: nothing is written and
 * the caller's scan should continue. Otherwise the record is seeded (activity, state, coord/kind
 * fields, a parity flag from the decremented wave counter, an animation sequence, and a per-wave
 * spawn countdown) and the caller's scan should stop.
 *
 * Caller-skip signal: the boolean return drives the caller's scan. true = normal (busy, keep
 * scanning); false = skip (launched, abort). LIVE-OUT: memory only — the caller keeps its
 * counter/stride across the call and reads back no register.
 */

const BUSY = 0x01; // bit0 of the activity word marks a slot in use
const SPAWN_TIMER_BASE = 0x20; // per-wave countdown = base - min(wave, cap)
const WAVE_CAP = 0x0a; // wave clamp before the countdown subtraction

export function loc_2be5(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & BUSY) !== 0) return true; // busy -> keep scanning

  mem8[rec + 0x00] = 0x01;
  mem8[rec + 0x02] = 0x11;
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x04] = 0x1c;
  mem8[rec + 0x06] = 0x03;

  const wave = (mem8[WAVE_ARRIVAL_COUNTER] - 1) & 0xff; // consume one wave arrival
  mem8[WAVE_ARRIVAL_COUNTER] = wave;
  mem8[rec + 0x07] = wave & 0x01; // parity of the remaining count

  setActorAnimation(m, rec, ANIM_SEQ_2D5D);

  const clamped = wave < WAVE_CAP ? wave : WAVE_CAP;
  mem8[FORMATION_SPAWN_TIMER] = SPAWN_TIMER_BASE - clamped;
  mem8[rec + 0x09] = 0x10;
  return false; // slot launched -> abort the caller's scan
}
