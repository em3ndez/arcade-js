// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_34f0 — periodic refresh: reseed the random/animation byte and re-arm the
 * actor state byte.  ROM 0x34f0.
 *
 * The mover housekeeping vectors here on its rare periodic tick (once every 256
 * ticks). Two things happen:
 *   - A fresh draw is taken from the game's pseudo-random generator and forced
 *     into the upper half of the byte range — its high bit is always set, so the
 *     stored value is never below 128 — then written into the random/animation
 *     byte the actor code reads.
 *   - The actor state/timer byte is re-armed to a fixed restart value of 9.
 *
 * Taking the draw also advances the generator's own state, so the next draw
 * differs. The routine reads no caller input; its only "input" is the generator
 * state, which lives in memory — making it a near-leaf.
 *
 * The name stays neutral: the two bytes it writes (the random/animation seed and
 * the actor state/timer) are only weakly identified in the mechanism map, so the
 * game role here has not reached the confidence an English name would claim.
 *
 * Memory-equivalent to the frozen oracle — equivalence-34f0.test.js.
 * GATE:     exhaustive — over all 65,536 generator states the two written bytes
 *           and the advanced generator state match the oracle; plus real captured
 *           attract states and teeth. This chain is a gameplay-only path never
 *           reached in attract, so it is gated as a near-leaf sweep rather than a
 *           natural dispatch.
 * LIVE-OUT: memory — the random/animation byte, the actor state byte, and the two
 *           generator-state bytes advanceRandom advances. The accumulator is left
 *           at 9 to match the oracle (likely dead ABI; the memory gate backstops
 *           it). The oracle's residual working registers/flags and its dead stack
 *           push are not part of the contract.
 * NAMES:    ANIM_RAND (0x808b, the random/animation byte) and ACTOR_STATE (0x8084,
 *           the actor state/timer byte), both weakly identified; the generator
 *           state bytes are owned by advanceRandom.
 */

import { advanceRandom } from "./advanceRandom.js";
import { ANIM_RAND, ACTOR_STATE } from "./ram.js";

export function loc_34f0(m) {
  // A fresh generator draw, forced into the upper half of the byte range (high
  // bit set, so 128..255), becomes this cycle's random/animation seed.
  const seed = advanceRandom(m) | 0x80;
  m.mem.write8(ANIM_RAND, seed);

  // Re-arm the actor state/timer byte to its fixed restart value.
  m.mem.write8(ACTOR_STATE, 9);

  // The oracle leaves the accumulator holding this value; match it in case a
  // caller reads it back.
  m.regs.a = 9;
}
