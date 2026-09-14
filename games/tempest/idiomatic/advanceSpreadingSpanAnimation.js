// SPDX-License-Identifier: GPL-3.0-only
import { emitSegmentedSpanBetweenCursors } from "./emitSegmentedSpanBetweenCursors.js";
import { loc_14e, loc_14d, MODE_DISPATCH_SEL } from "./names.js";

/**
 * advanceSpreadingSpanAnimation — the "spread" beat of the paired-cursor span animation. ROM 0xb102
 * (redraw the two-cursor span, then step the cursors apart one frame).
 *
 * Role in the machine: Tempest animates several attract/transition sequences as a segmented vector run
 * drawn between two moving endpoints -- a near cursor (loc_14d) and a far cursor (loc_14e). This routine
 * is the phase that pulls those endpoints APART: each frame it re-emits the span and nudges the two
 * cursors so the drawn figure visibly grows/opens up. Its sibling advancePinchingSpanAnimation runs the
 * opposite (squeeze) beat. The main-loop trampoline selects which beat runs via the mode selector byte,
 * and this routine hands control off by rewriting that selector when the spread finishes.
 *
 * Behavior: first redraw the current span by calling emitSegmentedSpanBetweenCursors with the fixed
 * endpoints 0x34/0xaa (it reads the live cursor cells internally). Then advance the cursors: while the far
 * cursor is still below 0xa0, wrap it upward by 0x14 and store it back. Bail early (leave the near cursor
 * untouched) until the far cursor has climbed past 0x50. Once it has, step the near cursor up by 0x08 and
 * store it; bail again while the near cursor still trails the far cursor. When the near cursor finally
 * catches the far cursor the spread is complete: pin the near cursor at the 0xa0 ceiling and latch the
 * mode selector loc_1 (MODE_DISPATCH_SEL) to 0x14 so the next frame dispatches the following state.
 *
 * Live-out: the far cursor loc_14e and near cursor loc_14d (advanced this frame, or pinned at 0xa0 on
 * completion), and on completion the mode-dispatch selector MODE_DISPATCH_SEL = 0x14. Plus whatever vector
 * output emitSegmentedSpanBetweenCursors appended for this frame's span. Grounding: [seen].
 */
export function advanceSpreadingSpanAnimation(m) {
  const { mem8 } = m;
  // Redraw the span between the live near/far cursors (fixed style endpoints 0x34..0xaa).
  emitSegmentedSpanBetweenCursors(m, 0x34, 0xaa);
  let far = mem8[loc_14e];
  // Wrap the far cursor upward by 0x14 while it is still below the 0xa0 ceiling.
  if (far < 0xa0) {
    far = (far + 0x14) & 0xff;
    mem8[loc_14e] = far;
  }
  // Hold the near cursor until the far cursor has cleared the 0x50 floor.
  if (far < 0x50) return;
  // Step the near cursor up by 0x08 to chase the far cursor.
  const near = (mem8[loc_14d] + 0x08) & 0xff;
  mem8[loc_14d] = near;
  // Not yet caught up: leave the pair spreading and finish this frame.
  if (near < far) return;
  // Spread complete: pin the near cursor at the ceiling and hand off to the next state.
  mem8[loc_14d] = 0xa0;
  mem8[MODE_DISPATCH_SEL] = 0x14; // latch the mode-dispatch selector to advance the sequence
}
