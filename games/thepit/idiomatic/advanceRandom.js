// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceRandom — step the game's pseudo-random generator and hand back a fresh byte.  ROM 0x4b1a.
 *
 * The generator's state is a 16-bit value kept little-endian in two work-RAM bytes
 * (low then high). It is a linear-feedback shift register: every step the whole
 * 16-bit value shifts right one place, a feedback bit enters at the top, and the
 * bit that falls off the bottom is discarded. The feedback bit is the XOR of two
 * low-end bits of the low byte, so the stream never simply repeats the value.
 *
 * A shift register whose state is all zero would stay zero forever (nothing to
 * feed back), so before shifting, an all-zero state is reseeded to a fixed small
 * nonzero value — the generator can never lock up.
 *
 * The new low byte doubles as the returned random draw: callers take it and mask
 * or fold it down to the range they need (a table index, a jitter amount, a bit
 * flag). Used by the column animation and the object/enemy update paths.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b1a.test.js.
 * GATE:     exhaustive — new state + returned byte vs the oracle over all 65,536
 *           (low,high) generator states, plus real captured attract states for a
 *           full-RAM check. Reached in attract (dispatched from advanceBackgroundSprite/spawnPendingDigObject/
 *           reseedMoverCadenceAndRearmState), but its output depends only on the two state bytes.
 * LIVE-OUT: memory (the two PRNG-state bytes) + the accumulator (the returned
 *           byte). The residual working registers and flags are dead ABI — every
 *           caller immediately masks the returned byte, discarding the flags, and
 *           reads no other register.
 * NAMES:    the PRNG state bytes 0x800d (low) / 0x800e (high) have no ram.js name
 *           yet, so they stay hex; no other RAM is touched.
 */

import { PRNG_LOW, PRNG_HIGH } from "./ram.js";
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
