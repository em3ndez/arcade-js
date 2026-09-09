// SPDX-License-Identifier: GPL-3.0-only
import { loc_c5, loc_c8, loc_c9, loc_cb, loc_d3, loc_d4 } from "./names.js";

/**
 * stepPhasedCountersAndWrapCells — a per-tick bookkeeping step. A 2-bit phase
 * picks a sub-step {0,1,2} that is subtracted from a 16-bit accumulator (high:low
 * with a wrap counter); the accumulator floors at zero instead of wrapping past
 * it. Then a frame counter ticks, and on even frames a two-pass sweep normalises
 * three coordinate cells into a modulo-0x10 grid: pass 1 subtracts 0x10 from any
 * cell >= 0x10, and only if that changed nothing, pass 2 subtracts 0x11 from each
 * nonzero cell, stopping the moment a result goes negative.
 */
export function stepPhasedCountersAndWrapCells(m) {
  const { mem8 } = m;
  const phase = mem8[loc_d3] & 0x03;

  if (phase === 0) {
    // Phase 0: clear the accumulator low byte; no wrap-counter bump.
    mem8[loc_c9] = 0;
  } else {
    // LSR / ADC #0 -> step = round(phase/2): phase 1->1, 2->1, 3->2.
    const carryIn = phase & 0x01;
    const step = ((phase >> 1) + carryIn) & 0xff;
    // low - step; carry set == no borrow (low >= step).
    let acc = (step ^ 0xff) + mem8[loc_c9] + 1;
    let value = acc & 0xff;
    const noBorrow = acc > 0xff;

    let storeC9 = true;
    let bumpC8 = true;
    if (!noBorrow) {
      // borrow: fold the low result into the high byte.
      acc = value + mem8[loc_cb];
      value = acc & 0xff;
      if (value & 0x80) {
        // high byte went negative -> discard the whole update.
        storeC9 = false;
        bumpC8 = false;
      } else {
        mem8[loc_cb] = value; // store high byte
        value = 0; // the low-byte store below writes 0
      }
    }

    if (bumpC8) {
      // bump the wrap counter an extra time only when phase == 1.
      if (phase < 2) mem8[loc_c8] = mem8[loc_c8] + 1;
      mem8[loc_c8] = mem8[loc_c8] + 1;
    }
    if (storeC9) {
      mem8[loc_c9] = value; // store accumulator low byte
    }
  }

  // tick the frame counter; on odd frames skip the cell sweep.
  const frame = (mem8[loc_d4] + 1) & 0xff;
  mem8[loc_d4] = frame;
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
