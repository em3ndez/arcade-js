// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFrogAnimIndexAndRedispatch  —  ROM 0x1029  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The step-and-loop driver of the frog-animation pipeline. The pipeline has eleven animation "arms"
 *   (indices 0..10), and every frame the whole set is walked and redrawn. This routine is that walk's
 *   increment-and-test: it bumps the animation-index cell by one, then either re-enters the dispatcher to
 *   draw the next arm, or — once every arm has been drawn — wraps the index back to 0 and stops.
 *
 * WHERE IT SITS
 *   It is the tail of every arm's render path. dispatchFrogAnimationArm (ROM 0x0faf) reads the index cell
 *   and jumps to one arm's render routine; that arm funnels through the shared tile-column loop
 *   renderFrogAnimTileColumns (ROM 0x0ff1), which — after stamping its last column — hands here. So this
 *   routine and the dispatcher form a mutual recursion:
 *       bump → dispatch arm k → render → back here → bump → dispatch arm k+1 → …
 *   A single top-level dispatch entry therefore renders every arm from the current index up through arm 10
 *   in one sweep, then leaves the index at 0 ready for the next frame's sweep. (Arm 5 has no render body:
 *   dispatchFrogAnimationArm sends index 5 straight here, so that slot advances the index without drawing.)
 *
 * LIVE-OUT
 *   Memory only — the animation-index cell (loc_8000, 0x8000). It returns nothing the caller reads; the
 *   arms it re-triggers do all the visible work (VRAM tile stamping and sprite-object plotting).
 */
import { loc_8000 } from "./names.js";
import { dispatchFrogAnimationArm } from "./dispatchFrogAnimationArm.js";

// Number of animation arms: indices run 0..10, so eleven in all. The index wraps once it reaches this
// count. In the ROM the bumped index is compared against 0x0b (11) directly.
const ANIM_ARM_COUNT = 0x0b;

export function advanceFrogAnimIndexAndRedispatch(m) {
  const { mem8 } = m;

  // ── Step the animation index ──────────────────────────────────────────────────────────
  // loc_8000 (0x8000) is work-RAM page-0x80's base cell, and within the frog-animation cluster it holds
  // the current arm index (0..10). Increment it in place — masked to a byte to mirror the ROM's 8-bit
  // INC — and store the new value back. This is the "bump" that moves the walk from one arm to the next.
  const index = (mem8[loc_8000] + 1) & 0xff;
  mem8[loc_8000] = index;

  // ── More arms left to draw? re-dispatch the next one ──────────────────────────────────
  // While the bumped index is still below the arm count (11), the frame's sweep is not finished: hand
  // back to dispatchFrogAnimationArm, which reads this same cell and renders the arm the new index names.
  // This is a direct tail-call — the arm's render chain runs to completion and returns back through us in
  // a single unwind, so the whole recursion resolves to one net return to the original caller.
  if (index < ANIM_ARM_COUNT) return dispatchFrogAnimationArm(m);

  // ── Sweep complete → wrap the index to 0 and stop ─────────────────────────────────────
  // The index has reached 11: every arm 0..10 has now been drawn this frame. Reset the cell to 0 so the
  // next frame's dispatch begins a fresh sweep at arm 0, then plain-return, ending the recursion. (The
  // bump above momentarily wrote 11 into the cell; nothing reads it between there and here, so this
  // overwrite is the value that actually lands — faithful to the ROM's INC-then-clear-on-wrap sequence.)
  mem8[loc_8000] = 0;
  return;
}
