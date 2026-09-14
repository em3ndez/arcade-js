// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SHAPE_ACTIVE, TIMED_OBJECT_COUNT } from "./names.js";

/**
 * clearEightByteTableAndFlag — reset leaf: blank the 8-byte shape-active table plus its trailing flag.
 * ROM 0x929f.
 *
 * Role in the machine: Tempest tracks a small fixed-size table of per-slot shape/object state at loc_30a
 * (eight entries) together with a companion count/flag byte at loc_116 (the timed-object count). This leaf
 * returns both to their baseline as part of a wave/level reset, so the object bookkeeping starts empty for
 * the next wave rather than carrying stale slot state.
 *
 * Behavior: a top-down loop over the eight cells loc_30a..loc_30a+7 (index x from 7 down to 0), storing
 * 0x00 into each, then a single store of 0x00 into the trailing flag loc_116. No branches beyond the loop,
 * no reads, no other state.
 *
 * Live-out: loc_30a..loc_30a+7 all = 0 and loc_116 = 0. Nothing else touched. Grounding: [seen].
 */
export function clearEightByteTableAndFlag(m) {
  const { mem8 } = m;
  // Blank the 8-byte shape-active table loc_30a..loc_30a+7 top-down.
  for (let x = 7; x >= 0; x--) mem8[u16(SHAPE_ACTIVE + x)] = 0x00;
  // Clear the trailing timed-object count/flag loc_116.
  mem8[TIMED_OBJECT_COUNT] = 0x00;
}
