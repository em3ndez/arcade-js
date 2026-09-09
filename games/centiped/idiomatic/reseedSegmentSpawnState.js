// SPDX-License-Identifier: GPL-3.0-only
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";
import { seedWaveState } from "./seedWaveState.js";
import { loc_2505 } from "./loc_2505.js";

/**
 * reseedSegmentSpawnState — the "restart a centipede from scratch" chain entry.
 *
 * Role in the machine: several higher-level paths — the death/respawn dispatcher and the secondary
 * object spine — need to bring a fresh centipede into being partway through a round. Rather than
 * inline the setup, they call this thin, branch-free chain: it reseeds the segment spawn cells, then
 * the per-wave working values, then flows straight on into the segment sprite-table rebuild spine so
 * the new creature's five sprite tables are materialised in the same pass. It carries no state and
 * makes no decisions — it just runs the three reinitialisers in the fixed order they depend on.
 *
 * ROM: the reseed entry that fronts the segment sprite-table rebuild. Grounding: [code] — a
 * straight-line reinitialize read from behaviour.
 *
 * Live-out: everything the three callees write (segment spawn cells, wave-state cells, and the
 * rebuilt sprite tables); returns the rebuild spine's result.
 */
export function reseedSegmentSpawnState(m) {
  // Step 1: seed the fixed spawn cells for the currently selected object slot (heading, coordinate,
  // motion seeds), so the strip has a well-defined starting geometry.
  seedSegmentSpawnState(m);

  // Step 2: seed the per-wave numbers (difficulty-scaled counts, scrambled seed pair, velocity seed)
  // that the sprite-table rebuild and the segment walk will read this wave.
  seedWaveState(m);

  // Step 3: fall through into the segment sprite-table rebuild spine, which builds the five 12-entry
  // sprite tables from the freshly seeded per-slot counters and descriptor rows.
  return loc_2505(m); // fall through into the segment sprite-table rebuild spine
}
