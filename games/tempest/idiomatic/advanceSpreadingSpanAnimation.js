// SPDX-License-Identifier: GPL-3.0-only
import { emitSegmentedSpanBetweenCursors } from "./emitSegmentedSpanBetweenCursors.js";
import { loc_14e, loc_14d, MODE_DISPATCH_SEL } from "./names.js";

// Rebuild the paired cursors, then clamp them: wrap the far cursor upward, and
// once it clears a floor, step the near cursor and pin it at the ceiling.
export function advanceSpreadingSpanAnimation(m) {
  const { mem8 } = m;
  emitSegmentedSpanBetweenCursors(m, 0x34, 0xaa);
  let far = mem8[loc_14e];
  if (far < 0xa0) {
    far = (far + 0x14) & 0xff;
    mem8[loc_14e] = far;
  }
  if (far < 0x50) return;
  const near = (mem8[loc_14d] + 0x08) & 0xff;
  mem8[loc_14d] = near;
  if (near < far) return;
  mem8[loc_14d] = 0xa0;
  mem8[MODE_DISPATCH_SEL] = 0x14;
}
