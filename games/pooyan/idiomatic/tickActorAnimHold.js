// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * tickActorAnimHold — advance one actor's animation-hold countdown and, on underflow, step
 * its animation phase.
 *
 * ROM 0x5d1e. Grounding: [seen].
 *
 * Every animated actor (the enemies riding the ropes, and friends) carries a small state
 * block; the caller hands this routine the base address of one such record. Two of the
 * record's fields together form a simple animation clock:
 *   - +0x12 is a HOLD TIMER — how many more frames the current animation cell is shown.
 *   - +0x13 is a 2-bit PHASE counter (0..3) — which cell of a short cycle is showing, counted
 *     down toward 0.
 * Each frame this routine ticks the hold timer; when the hold reaches zero the actor has
 * finished dwelling on its current cell, so the phase steps down by one and the hold is
 * re-armed for the next cell, until the phase is exhausted and the animation stops.
 *
 * The whole thing is fenced behind three enable conditions so a still or off-screen actor
 * costs nothing:
 *   - +0x0b bit0 is a per-record "always animate" flag; when it is clear the actor is instead
 *     animated only on odd rounds, gated by bit0 of ROUND_COUNTER (0x8907, the running frame /
 *     round tick) — a cheap way to halve the animation rate for those actors.
 *   - +0x00 bit0 is the record's ACTIVE flag; a dormant slot is skipped.
 *   - +0x16 bit1 is the ARMED flag; the hold clock only runs while it is set. (Note +0x16 is
 *     read here as bit1 but written below as the whole byte 0x00 / 0x01, matching the ROM.)
 *
 * LIVE-OUT: memory-only — mutates the handed record; nothing is returned or read back.
 */
export function tickActorAnimHold(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Enable gate, first arm: the per-record "always animate" flag at +0x0b bit0. When it is
  // clear, fall back to animating only when ROUND_COUNTER (0x8907) bit0 is clear — i.e. skip
  // this actor on odd rounds, halving its animation rate. If both are unset for animating,
  // bail for the frame.
  if ((mem8[rec + 0x0b] & 0x01) === 0 && (mem8[ROUND_COUNTER] & 0x01) !== 0) return;

  // The record must be live: +0x00 bit0 is the ACTIVE flag. A dormant slot animates nothing.
  if ((mem8[rec + 0x00] & 0x01) === 0) return;

  // ...and armed: +0x16 bit1 must be set for the hold clock to run.
  if ((mem8[rec + 0x16] & 0x02) === 0) return;

  // Tick the hold timer at +0x12 down one, wrapping at the byte boundary, and store it back.
  // While it is still non-zero the current animation cell keeps showing, so we are done.
  const timer = u8(mem8[rec + 0x12] - 1);
  mem8[rec + 0x12] = timer;
  if (timer !== 0) return;

  // Hold underflowed: the current cell's dwell is up. Read the 2-bit phase at +0x13. Phase 0
  // means the cycle has run out of cells, so disarm (+0x16 = 0) and stop animating this actor.
  const phase = mem8[rec + 0x13] & 0x03;
  if (phase === 0) {
    mem8[rec + 0x16] = 0x00;
    return;
  }

  // Otherwise advance to the next cell: step the phase down one and re-arm (+0x16 = 1) so the
  // hold timer, reseeded elsewhere, runs again for the new cell next frame.
  mem8[rec + 0x13] = phase - 1;
  mem8[rec + 0x16] = 0x01;
}
