// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_64 } from "./names.js";
import { advanceSegmentCoordAndArm } from "./advanceSegmentCoordAndArm.js";

/**
 * commitSegmentCoord — the coordinate-store step handler in the per-segment walk's handoff ring.
 *
 * Role in the machine: the segment mover computes a fresh horizontal grid coordinate for segment X
 * and passes it here in the accumulator (A). This handler's one job is to write that value back into
 * the segment's coordinate field $64+X, then hand the walk on to the next step. It is the "commit"
 * point where a computed move becomes the segment's new position on the field.
 *
 * ROM: the store-and-continue step in the centipede segment-walk chain. Grounding: [code] — read from
 * behaviour; $64 is a bare zero-page segment field indexed by the slot number.
 *
 * Live-out: writes mem8[$64+X] = A; then whatever advanceSegmentCoordAndArm mutates. X and A default
 * to the machine's current register values so a bare tail-call carries the live slot/coordinate.
 */
export function commitSegmentCoord(m, x = m.regs.x, a = m.regs.a) {
  // Store the freshly computed coordinate into this segment's $64+X field (u8-wrapped so a slot
  // index past the page edge folds exactly as the 6502's zero-page indexing did).
  m.mem8[u8(loc_64 + x)] = a;

  // Tail-transfer to the next stage: advance the coordinate by its delta and test the arm condition.
  // The store is the whole body; this handoff is what keeps the per-segment walk moving.
  return advanceSegmentCoordAndArm(m, x);
}
