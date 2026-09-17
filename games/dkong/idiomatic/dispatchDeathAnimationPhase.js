// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchDeathAnimationPhase — vector Mario's death animation to its current-phase handler, read
 * from a 4-entry jump table of little-endian target addresses (slot 3 is unreachable padding).
 *
 * LIVE-OUT: memory-only — the dispatched arm's RAM writes.
 */

import { loc_00ca } from "../translated/loc_00ca.js";
import { DEATH_ANIM_PHASE } from "./names.js";

const PHASE_TABLE = 0x1283;
const DISPATCH_TABLE_1283 = "0x1283 (0x639D dispatch)";

export function dispatchDeathAnimationPhase(m) {
  const { mem8 } = m;

  const phase = mem8[DEATH_ANIM_PHASE];

  // Doubling into the table offset is an 8-bit result: base + (2*phase & 0xff), not base + 2*phase.
  const entry = (PHASE_TABLE + ((phase * 2) & 0xff)) & 0xffff;
  const target = mem8[entry] | (mem8[(entry + 1) & 0xffff] << 8);

  loc_00ca(m, target, DISPATCH_TABLE_1283);
}
