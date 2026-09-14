// SPDX-License-Identifier: GPL-3.0-only
import { emitSegmentedSpanBetweenCursors } from "./emitSegmentedSpanBetweenCursors.js";
import { loc_14d, loc_14e } from "./names.js";

/**
 * advancePinchingSpanAnimation — one frame of the "pinch the span shut" vector
 * animation. ROM 0xb131 (redraw the paired-cursor span, then squeeze the two
 * cursors together by one step).
 *
 * Role in the machine: Tempest paints its attract/transition flourishes as
 * animated vector spans — a segmented run laid down between a moving cursor
 * pair. This routine is the closing half of that gesture (its sibling
 * advanceSpreadingSpanAnimation at 0xb102 opens the span apart). Each call
 * advances the animation by a single frame: it re-emits the span with the
 * cursors at their current positions, then walks the near and far cursors one
 * notch closer together so that over successive frames the drawn span collapses
 * to nothing. The cursor pair lives in the two config cells loc_14d (near) and
 * loc_14e (far).
 *
 * Behavior: first hand the current cursor pair to emitSegmentedSpanBetween
 * Cursors(0x3f, 0x4e) to lay down this frame's vector run. Then pull the near
 * cursor loc_14d down by one, but only while it is still at or above the 0x30
 * floor (once it drops below, it stops moving). If that decrement wrapped the
 * near cursor past 0x80 (i.e. underflowed below 0x00), the span is done — bail
 * without touching the far cursor. Otherwise pull the far cursor loc_14e down
 * by one as well, clamped so it never crosses below the near cursor — the two
 * meet rather than passing through each other.
 *
 * Live-out: loc_14d (near cursor, decremented while >= 0x30) and loc_14e (far
 * cursor, stepped down but floored at the near cursor) — the next frame reads
 * both back to continue the pinch. Grounding: [seen].
 */
export function advancePinchingSpanAnimation(m) {
  const { mem8 } = m;
  // Lay down this frame's vector run spanning the current near/far cursor pair.
  emitSegmentedSpanBetweenCursors(m, 0x3f, 0x4e);
  let near = mem8[loc_14d];
  // Step the near cursor one notch toward the far one, but only while it is
  // still above the 0x30 floor; below that it holds position.
  if (near >= 0x30) {
    near = (near - 1) & 0xff;
    mem8[loc_14d] = near;
  }
  // If the decrement underflowed past zero (wrapped high), the pinch is
  // finished — leave the far cursor alone and return.
  if (near >= 0x80) return;
  // Pull the far cursor down by one as well, but clamp it at the near cursor so
  // the pair converges instead of crossing.
  const stepped = (mem8[loc_14e] - 1) & 0xff;
  mem8[loc_14e] = stepped >= near ? stepped : near;
}
