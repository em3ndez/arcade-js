// SPDX-License-Identifier: GPL-3.0-only
import { loc_c5, loc_c8, SEGMENT_MOVE_ACCUM_B, SEGMENT_ROW_CROSS_COUNT, loc_d3, SEGMENT_MOVE_FRAME_COUNTER } from "./names.js";

/**
 * stepPhasedCountersAndWrapCells — the per-tick bookkeeping tail of the centipede
 * body strip (ROM 0x341b). [code]
 *
 * ROLE. Every exit from advanceSegmentColumns (the marching-accumulator walk that
 * inches the three-column centipede body across the field a row at a time) continues
 * into this routine. Its job is pure housekeeping on the movement counters: bleed a
 * small phase-picked amount out of the shared movement accumulator, tick the free-
 * running movement frame counter, and periodically fold the three per-column progress
 * cells back into a small grid so their readings stay bounded frame after frame.
 * Nothing here moves a sprite; it keeps the numbers the mover depends on in range.
 *
 * MECHANISM. A 2-bit phase (from loc_d3) picks a sub-step of 0, 1, or 2 that is
 * subtracted from a 16-bit accumulator held as high byte SEGMENT_ROW_CROSS_COUNT :
 * low byte SEGMENT_MOVE_ACCUM_B, with loc_c8 as an extra wrap counter. The subtract
 * is done the way the 6502 does it (add the one's-complement + carry), and the
 * accumulator FLOORS at zero rather than wrapping past it — so an underflow never
 * makes the creature's motion run backward. Then SEGMENT_MOVE_FRAME_COUNTER ticks;
 * only on even frames does a two-pass sweep normalise the three loc_c5 progress cells
 * into a modulo-0x10 grid (pass 1 subtracts 0x10 from any cell >= 0x10; only if pass 1
 * changed nothing does pass 2 subtract 0x11 from each nonzero cell, stopping at the
 * first negative result).
 *
 * LIVE-OUT. Writes SEGMENT_MOVE_ACCUM_B, SEGMENT_ROW_CROSS_COUNT, loc_c8,
 * SEGMENT_MOVE_FRAME_COUNTER, and the three loc_c5 progress cells; returns nothing.
 */
export function stepPhasedCountersAndWrapCells(m) {
  const { mem8 } = m;
  // The low two bits of loc_d3 select which of four sub-step behaviours this tick takes.
  const phase = mem8[loc_d3] & 0x03;

  if (phase === 0) {
    // Phase 0: clear the accumulator low byte; no wrap-counter bump.
    mem8[SEGMENT_MOVE_ACCUM_B] = 0;
  } else {
    // LSR / ADC #0 -> step = round(phase/2): phase 1->1, 2->1, 3->2.
    const carryIn = phase & 0x01;
    const step = ((phase >> 1) + carryIn) & 0xff;
    // low - step; carry set == no borrow (low >= step).
    let acc = (step ^ 0xff) + mem8[SEGMENT_MOVE_ACCUM_B] + 1;
    let value = acc & 0xff;
    const noBorrow = acc > 0xff;

    let storeC9 = true;
    let bumpC8 = true;
    if (!noBorrow) {
      // borrow: fold the low result into the high byte.
      acc = value + mem8[SEGMENT_ROW_CROSS_COUNT];
      value = acc & 0xff;
      if (value & 0x80) {
        // high byte went negative -> discard the whole update.
        storeC9 = false;
        bumpC8 = false;
      } else {
        mem8[SEGMENT_ROW_CROSS_COUNT] = value; // store high byte
        value = 0; // the low-byte store below writes 0
      }
    }

    if (bumpC8) {
      // bump the wrap counter an extra time only when phase == 1.
      if (phase < 2) mem8[loc_c8] = mem8[loc_c8] + 1;
      mem8[loc_c8] = mem8[loc_c8] + 1;
    }
    if (storeC9) {
      mem8[SEGMENT_MOVE_ACCUM_B] = value; // store accumulator low byte
    }
  }

  // tick the frame counter; on odd frames skip the cell sweep.
  const frame = (mem8[SEGMENT_MOVE_FRAME_COUNTER] + 1) & 0xff;
  mem8[SEGMENT_MOVE_FRAME_COUNTER] = frame;
  if (frame & 0x01) return;

  // Even frame — Pass 1: subtract 0x10 from each cell >= 0x10, counting adjustments.
  let adjusted = 0;
  for (let i = 2; i >= 0; i--) {
    const cell = (loc_c5 + i) & 0xff;
    const v = mem8[cell];
    if (v === 0 || v < 0x10) continue;
    mem8[cell] = v + 0xef + 1; // ADC #$EF with carry set == v - 0x10 (view truncates the carry)
    adjusted = (adjusted + 1) & 0xff;
  }
  if (adjusted !== 0) return;

  // Pass 2 (only when pass 1 changed nothing): subtract 0x11 from each nonzero cell, early-out on
  // the first result that goes negative.
  for (let i = 2; i >= 0; i--) {
    const cell = (loc_c5 + i) & 0xff;
    const v = mem8[cell];
    if (v === 0) continue;
    const r = (v + 0xef) & 0xff; // CLC / ADC #$EF == v - 0x11
    mem8[cell] = r;
    if (r & 0x80) return;
  }
}
