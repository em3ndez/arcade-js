// SPDX-License-Identifier: GPL-3.0-only
//
// advanceRandomSeed (ROM 0x003c, [seen]) -- draw one pseudo-random byte.
//
// WHAT IT IS
//   Galaxian's shared random-number generator. It advances a single 8-bit linear-congruential (LCG)
//   seed one step and returns the new value, so callers get a fresh "random" byte per draw. Every part
//   of the game that needs randomness -- enemy launch direction, dive timing, the jittered projectile
//   velocity, the boot-time color ramp -- pulls from this one seed, which makes the whole game
//   deterministic given a starting seed.
//
// ROLE IN THE MACHINE
//   RNG_SEED (0x401e) holds the seed. The recurrence is seed' = (seed*5 + 1) mod 256, the classic
//   byte-wide LCG. The new seed is both stored back and returned in register A as this draw's value.
//
// LIVE-OUT: RNG_SEED (0x401e); register A = the new seed.
import { RNG_SEED } from "./names.js";

export function advanceRandomSeed(m) {
  const { mem8 } = m;

  // Advance the seed one LCG step (seed*5 + 1, wrapped to a byte) and store it back.
  const seed = mem8[RNG_SEED];
  const next = (seed * 5 + 1) & 0xff;
  mem8[RNG_SEED] = next;

  // Return the new seed in A as this draw's random value.
  return (m.regs.a = next);
}
