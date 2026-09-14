// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_3fe, loc_405, SPIKE_TABLE_GUARD } from "./names.js";

/**
 * rebuildSpikeTable — reset the per-lane spike table to its empty baseline. ROM 0xa7bd.
 *
 * Role in the machine: spikes are the vertical hazards Spikers extrude up the tube lanes; the game tracks
 * how far each lane's spike has grown in an 8-byte per-lane table. At the start of a new level (or wave
 * regen) that table must be reset so no lane carries a stale spike height. This routine writes that empty
 * baseline: all lanes cleared, a sentinel in the final slot, and the remap reference re-armed.
 *
 * Behaviour: walk the 8-byte table loc_3fe (indices 7..0) writing 0x00 to clear every lane's spike
 * height, then stamp the last slot loc_405 = 0xf0 (a max/sentinel guard the lane scan keys off), and set
 * the remap-reference guard cell loc_115 = 0xff to arm it. Explicit early-form return, no value.
 *
 * Live-out: the cleared spike table loc_3fe..loc_405 (last slot = 0xf0) and the guard cell loc_115 = 0xff.
 * Grounding: [seen].
 */
export function rebuildSpikeTable(m) {
  const { mem8 } = m;
  for (let x = 7; x >= 0; x--) mem8[u16(loc_3fe + x)] = 0x00; // clear every lane's spike height
  mem8[loc_405] = 0xf0; // stamp the final slot with the sentinel guard value
  mem8[SPIKE_TABLE_GUARD] = 0xff; // arm the remap-reference guard cell
  return;
}
