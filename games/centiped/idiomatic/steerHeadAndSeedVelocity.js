// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_00, loc_40, loc_43, HEAD_VELOCITY_SEED, loc_60, loc_70, loc_80, loc_88,
  loc_9a, loc_ab, loc_b8, loc_ef, loc_f0, POKEY_RANDOM,
} from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { guardHeadOrientationWrap } from "./advanceHeadOrientation.js";
import { returnNoop } from "./returnNoop.js";
import { storeHeadVelocity } from "./storeHeadVelocity.js";

// seedHead -- lay down a brand-new heading/velocity/position for the head. This is what makes a head
// "choose a new direction": a fresh orientation into loc_40, a random small velocity magnitude into the
// head velocity seed (HEAD_VELOCITY_SEED, $50), a random vertical position into loc_70, and both running
// accumulators loc_60/loc_80 cleared. Magnitude is 2 only when the slot is wide (its length gate loc_ab
// reads >= 2) AND the POKEY hardware RNG (POKEY_RANDOM, $100a) permits, else 1; the sign is a coin-flip
// off the RNG's top bit, so the head is equally likely to strike up or down. The 0x?? ^ loc_ef / ^ loc_f0
// folds carry the machine's direction selectors so the seeded values already sit in the folded frame the
// rest of the head code reads. loc_b8 is re-armed to a fixed dwell constant on the way in.
function seedHead(m) {
  const { mem8 } = m;
  mem8[loc_b8] = 0x14;
  mem8[loc_40] = 0x30 ^ mem8[loc_ef];
  const wide = mem8[u8(loc_ab + mem8[loc_88])] >= 0x02 && (mem8[POKEY_RANDOM] & 0x03) !== 0;
  const magnitude = wide ? 0x02 : 0x01;
  const velocity = mem8[POKEY_RANDOM] & 0x80 ? u8(-magnitude) : magnitude;
  mem8[HEAD_VELOCITY_SEED] = velocity;
  mem8[loc_60] = 0;
  mem8[loc_80] = 0;
  mem8[loc_70] = u8(((mem8[POKEY_RANDOM] & 0x78) + 0x70) ^ mem8[loc_f0]);
}

// commitVelocity -- the shared commit stage every steering path funnels into. First an escape hatch:
// if the state gate loc_43 has any of its 0xaf mask bits set the wave is in a special mode (e.g. a
// wave-start / death handoff), so instead of stepping the head it reseeds the whole wave. Otherwise it
// folds the seeded step (HEAD_VELOCITY_SEED, $50) onto the running velocity (loc_60), adding or
// subtracting by the direction selector loc_ef, and hands the result to storeHeadVelocity along with a
// zero flag so the store can route a stalled head back to a reseed.
function commitVelocity(m) {
  const { mem8 } = m;
  if ((mem8[loc_43] & 0xaf) !== 0) return seedWaveState(m);
  const base = mem8[loc_60];
  const step = mem8[HEAD_VELOCITY_SEED];
  const velocity = mem8[loc_ef] === 0 ? u8(base + step) : u8(base - step);
  return storeHeadVelocity(m, velocity, velocity === 0);
}

/**
 * steerHeadAndSeedVelocity -- the centipede head's per-tick steering decision (ROM 0x2e0b). [code]
 *
 * ROLE. Called once per frame from the main-loop tail, this is where the lead segment decides
 * where to point next. It reads the head's current heading and vertical position (both kept in a
 * "folded" frame, XOR'd with the machine's direction selectors loc_ef/loc_f0 so the same code
 * handles both travel directions), and chooses between three outcomes: guard the heading as it
 * wraps around the top of its range, carry straight on to the velocity-commit stage, or -- under a
 * tight set of conditions -- pick a whole new heading/velocity before committing. Committing then
 * feeds storeHeadVelocity, which latches the velocity and either advances the head or reseeds the
 * wave. This routine plus its two helpers are the steering brain of the centipede's head.
 *
 * LIVE-OUT. No writes of its own; it dispatches into guardHeadOrientationWrap, commitVelocity, or
 * returnNoop (via seedHead + commitVelocity when it reseeds), each of which owns the actual stores.
 */
export function steerHeadAndSeedVelocity(m) {
  const { mem8 } = m;

  // Unfold the heading into the working frame. Near the very top of the range the heading is about
  // to wrap, so hand off to the wrap guard; a little below that it is already committed to a straight
  // line, so skip straight to the velocity commit without considering a re-seed.
  const orient = (mem8[loc_40] ^ mem8[loc_ef]) & 0xff;
  if (orient >= 0x34) return guardHeadOrientationWrap(m, orient);
  if (orient >= 0x30) return commitVelocity(m);

  // Otherwise consider re-seeding the head with a fresh direction, but only when EVERY condition
  // agrees: the head is near the top of its vertical position band (pos >= 0xf8), it is the right
  // tick phase (frame counter loc_00 == 0), the slot is still "young" (its length gate loc_9a reads
  // below 0x0b), and the hardware RNG rolls the low two bits to zero. Gating the re-seed this tightly
  // is what keeps the head from thrashing its heading every frame -- it changes course rarely and at
  // a well-defined moment.
  const pos = (mem8[loc_70] ^ mem8[loc_f0]) & 0xff;
  const reseed =
    pos >= 0xf8 &&
    mem8[loc_00] === 0 &&
    mem8[u8(loc_9a + mem8[loc_88])] < 0x0b &&
    (mem8[POKEY_RANDOM] & 0x03) === 0;
  if (!reseed) return returnNoop(m); // conditions not met -> nothing to do this frame

  // Lay down a fresh heading/velocity/position, then commit it.
  seedHead(m);
  return commitVelocity(m);
}
