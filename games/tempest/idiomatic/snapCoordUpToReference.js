// SPDX-License-Identifier: GPL-3.0-only
import { OBJ_DEPTH, DEPTH_LO, DEPTH_HI } from "./names.js";

/**
 * snapCoordUpToReference — nudge a lagging depth counter up to its reference. ROM 0xc453.
 *
 * Role in the machine: part of the rim-counter bring-up. When initAndDrawRimDepthCounters
 * (0xc30d) first seeds the two rim depth counters through the projection integrator, the low
 * counter loc_57 (OBJ_DEPTH) can fall behind the high reference loc_5f (DEPTH_HI) as the lane
 * index winds down to 0x0f. This routine closes that gap so the two counters stay a fixed span
 * apart, which keeps the rim depth readout drawing at the right place along the tube.
 *
 * Behavior: guarded three ways. It does nothing unless the guard byte loc_5b (DEPTH_LO) is clear
 * (zero) — a nonzero guard means the caller is not in the state where a nudge is wanted. It also
 * bails when loc_57 already sits 0x0c or more above the reference loc_5f, i.e. only a genuinely
 * lagging counter is touched. When both conditions pass it lifts loc_57 to loc_5f + 0x0f, then
 * clamps that to a ceiling of 0xf0 so the counter can never run off the top of the tube.
 *
 * Live-out: OBJ_DEPTH (loc_57), the low rim depth counter, raised toward the reference.
 * Grounding: [seen].
 */
export function snapCoordUpToReference(m) {
  const { mem8 } = m;
  if (mem8[DEPTH_LO] !== 0) return;                    // guard loc_5b set -> leave the counter alone
  if (mem8[OBJ_DEPTH] - mem8[DEPTH_HI] >= 0x0c) return; // already close enough to the reference
  let v = mem8[DEPTH_HI] + 0x0f;                        // target = reference loc_5f + a fixed 0x0f span
  if (v >= 0xf0) v = 0xf0;                              // clamp to the top-of-tube ceiling
  mem8[OBJ_DEPTH] = v;
}
