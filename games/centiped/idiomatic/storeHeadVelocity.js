// SPDX-License-Identifier: GPL-3.0-only
import { loc_60, loc_8b } from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { advanceHeadOrientationAndStampTile } from "./advanceHeadOrientation.js";

/**
 * storeHeadVelocity -- commit the centipede head's new velocity (ROM 0x2e8c). [code]
 *
 * ROLE. The velocity-commit leaf of the head-steering chain. steerHeadAndSeedVelocity
 * decides the head's heading each tick and folds a fresh step onto the running velocity;
 * it hands the finished value here to be latched into the head's velocity cells and then
 * routes the head onward by whether it is actually moving. This is the single point where
 * the just-computed velocity becomes the head's stored state.
 *
 * MECHANISM. The velocity is written into two cells at once: loc_60, the running
 * head-velocity cell the motion integrator reads, and loc_8b, the scratch/shadow copy the
 * sibling handlers pick up. Then the head is dispatched by the velocity's zero-ness — a
 * moving head (nonzero) advances its orientation and stamps the tile it faces (that is how
 * it eats a mushroom in its path); a stalled head (zero) means the wave has nothing left to
 * carry, so the whole wave state is reseeded to bring a fresh centipede into being.
 *
 * LIVE-OUT. Writes loc_60 and loc_8b, then tail-calls one of the two continuations. The
 * caller supplies the velocity in A and its zero flag; the source's textual fall-through
 * past the two branches is unreachable because they are exhaustive on that flag.
 */
export function storeHeadVelocity(m, a = m.regs.a, zero = m.regs.fZ) {
  // Latch the velocity into both the live cell (loc_60, read by the integrator) and its
  // shadow copy (loc_8b, read by the sibling step handlers).
  m.mem8[loc_60] = a;
  m.mem8[loc_8b] = a;
  // Nonzero velocity -> the head is moving: advance its orientation and stamp the faced tile.
  if (!zero) return advanceHeadOrientationAndStampTile(m);
  // Zero velocity -> the head is stalled: reseed the whole wave to spawn a fresh centipede.
  return seedWaveState(m);
}
