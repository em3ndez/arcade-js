// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { moveCentipedeSegment } from "./moveCentipedeSegment.js";

/**
 * advanceSegmentLoopIndex -- the tail of the per-segment loop. Steps the segment cursor to the
 * previous slot; once it runs past the first slot the whole strip is done and the routine returns
 * (the seam supplies the ret), otherwise it re-enters the loop head for the next segment. [code]
 */
export function advanceSegmentLoopIndex(m, x = m.regs.x) {
  const nx = u8(x - 1);
  if (nx & 0x80) return; // stepped past the first slot -> strip done
  // Re-enter the loop head for the next segment.
  return (m.regs.x = nx), moveCentipedeSegment(m);
}
