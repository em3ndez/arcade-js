// SPDX-License-Identifier: GPL-3.0-only
//
// chooseNextAttackerDirection (ROM 0x13e1) -- [seen]
//
// WHAT IT IS
//   Set the shared attacker launch/curve direction flag loc_4215 to 0 or 1. It measures how close the
//   formation currently sits to one horizontal sweep bound and, near an edge, forces the next
//   attacker to peel AWAY from that edge; away from both edges it just rolls a fresh random bit.
//
// ROLE IN THE MACHINE
//   loc_4215 is consumed by the spawner launchAttackerFromFormation (it seeds a new attacker's
//   direction field, record+6) and by spawnObjectsOnDelayedEvent (left/right column scan), so this
//   one flag steers which way freshly launched divers curve. The inputs:
//     - FORMATION_ANCHOR (loc_420e): the 16-bit swept formation anchor; its high byte's sign bit says
//       which end of the travel the block is on, and thus which bound to measure the gap against.
//     - FORMATION_X_BOUNDS (0x4210): the [low, high] horizontal extent pair derived by
//       summarizeFormationOccupancy from the live column occupancy (low bound at +0, high at +1).
//   Keeping divers off the wall this way stops the formation from launching attackers straight into
//   the screen edge.
//
// LIVE-OUT: mem8[loc_4215] = 0 or 1. On the random path, RNG_SEED is also advanced one step.
import { advanceRandomSeed } from "./advanceRandomSeed.js";
import { loc_420e as FORMATION_ANCHOR, FORMATION_X_BOUNDS, loc_4215 } from "./names.js";

const EDGE_MARGIN = 28; // within this of a bound, force the direction instead of randomizing

export function chooseNextAttackerDirection(m) {
  const { mem8 } = m;

  // Read the anchor as low/high bytes and the two sweep bounds it is travelling between.
  const anchorLow = mem8[FORMATION_ANCHOR];
  const anchorHigh = mem8[FORMATION_ANCHOR + 1];
  const lowBound = mem8[FORMATION_X_BOUNDS];
  const highBound = mem8[FORMATION_X_BOUNDS + 1];

  // The 16-bit anchor's sign picks which bound to measure the gap against (an unsigned 8-bit
  // difference): a negative anchor is riding the high end, so measure distance to the high bound;
  // otherwise measure distance up from the low bound.
  const negative = (anchorHigh & 0x80) !== 0;
  const gap = negative ? (anchorLow - highBound) & 0xff : (lowBound - anchorLow) & 0xff;

  // Comfortably clear of the near edge: let a fresh random bit choose the direction freely.
  if (gap >= EDGE_MARGIN) {
    mem8[loc_4215] = advanceRandomSeed(m) & 0x01;
    return;
  }
  // Hugging an edge: force the flag away from it -- 0 near the high bound, 1 near the low bound.
  mem8[loc_4215] = negative ? 0 : 1;
}
