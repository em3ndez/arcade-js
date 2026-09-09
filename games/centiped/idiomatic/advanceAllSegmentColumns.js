// SPDX-License-Identifier: GPL-3.0-only
import { advanceSegmentColumns } from "./advanceSegmentColumns.js";

/**
 * advanceAllSegmentColumns — advance the whole three-column centipede-body strip by one row-step.
 *
 * ROM 0x335e. Grounding: [code] (read from the routine's own behaviour; no MAME-confirmed cell of
 * its own — it only forwards).
 *
 * ROLE IN THE MACHINE. The marching centipede's coarse motion is driven by a three-column "body
 * strip": columns 0, 1 and 2, each a step cell in the SEGMENT_COL_BODY array (0xcf..0xd1). Once per
 * frame the whole strip has to be stepped, and the per-column worker `advanceSegmentColumns` is
 * written to walk a column cursor DOWNWARD (2 → 1 → 0) via a 6502 DEX loop. This routine is the
 * public entry the frame dispatcher calls: its entire job is to preload that cursor to the last
 * column so the downward walk covers all three. The original 6502 did this as `LDX #2` immediately
 * before falling into the loop body at 0x3360.
 *
 * LIVE-OUT. No cell of its own. Everything it changes is written by `advanceSegmentColumns`
 * (the accumulators, per-column timers/bodies and progress counters); this routine just returns
 * that callee's tail value unchanged.
 */
export function advanceAllSegmentColumns(m) {
  // Preload the column cursor to index 2 (the last/highest column) and hand off. The callee's
  // DEX loop then services column 2, then 1, then 0, and exits when the cursor decrements past 0.
  return advanceSegmentColumns(m, 2);
}
