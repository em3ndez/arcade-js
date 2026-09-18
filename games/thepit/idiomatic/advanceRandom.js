// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceRandom — step the game's pseudo-random generator and hand back a fresh byte.
 * The generator's state is a 16-bit value kept little-endian in PRNG_LOW and PRNG_HIGH: a
 * linear-feedback shift register that each step shifts the whole value right one place, enters a
 * feedback bit (the XOR of two low-end bits of the low byte) at the top, and drops the bottom
 * bit. An all-zero state would stay zero forever, so it is reseeded to a fixed nonzero value
 * first — the generator never locks up. The new low byte doubles as the returned draw, which
 * callers mask or fold to the range they need.
 */

import { PRNG_LOW, PRNG_HIGH } from "./names.js";
export function advanceRandom(m) {
  const { mem8, regs } = m;

  const high = mem8[PRNG_HIGH];
  let low = mem8[PRNG_LOW];

  // An all-zero shift register is a dead state; reseed it to a fixed nonzero value.
  if ((high | low) === 0) low = 2;

  // Feedback bit fed into the top of the value: bit 1 XOR bit 2 of the low byte.
  const feedback = ((low >> 1) & 1) ^ ((low >> 2) & 1);

  // Shift the 16-bit value right one place: the feedback bit enters the very top,
  // the old high byte's lowest bit carries down into the top of the new low byte,
  // and the value's bottom bit falls off and is dropped.
  const newHigh = (feedback << 7) | (high >> 1);
  const newLow = ((high & 1) << 7) | (low >> 1);

  mem8[PRNG_HIGH] = newHigh;
  mem8[PRNG_LOW] = newLow;

  // The new low byte is the random draw the caller consumes from the accumulator.
  regs.a = newLow;
  return newLow;
}
