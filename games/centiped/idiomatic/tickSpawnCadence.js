// SPDX-License-Identifier: GPL-3.0-only
import { loc_88, loc_94, loc_87, loc_9c, loc_41, loc_ef, loc_9f } from "./names.js";
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";

/**
 * tickSpawnCadence -- advances the per-slot spawn cadence [code].
 *
 * While the slot's gate byte and the shared arm byte are both clear, it steps the slot phase
 * and re-arms the gate. Otherwise it range-tests a folded key and, each time a shared
 * countdown reaches zero, seeds the next segment spawn.
 */
export function tickSpawnCadence(m) {
  const x = m.mem8[loc_88];

  if ((m.mem8[(loc_94 + x) & 0xff] | m.mem8[loc_87]) === 0) {
    m.mem8[(loc_9c + x) & 0xff] = m.mem8[(loc_9c + x) & 0xff] + 1;
    m.mem8[loc_87] = 0x40;
    return;
  }

  if ((m.mem8[loc_41] ^ m.mem8[loc_ef]) < 0x9c) return;

  m.mem8[loc_9f] = m.mem8[loc_9f] - 1;
  if (m.mem8[loc_9f] === 0) seedSegmentSpawnState(m);
}
