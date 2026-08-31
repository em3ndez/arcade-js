// SPDX-License-Identifier: GPL-3.0-only
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { ANIM_FRAME_COUNTER } from "./names.js";
/**
 * primeAttractAnimAndPaintTileBlocks — priming entry point for the attract-screen tile animation.
 *
 * WHAT IT IS. A short shared entry that sits one step ahead of the attract-animation painter. It
 * aims a pointer at the animation-tick countdown cell, then continues straight on into
 * advanceAttractAnimationAndRepaint. Whatever that painter produces is handed back to this
 * routine's own caller — this routine keeps no work of its own on the way out.
 *
 * ROLE IN THE MACHINE. On the attract / idle screen the machine shows a small decoration built
 * from a 2x2 square of background tiles that cycles through four frames of artwork (two identical
 * copies appear on the display). The animation is paced by a countdown that is decremented once
 * per displayed video frame; when it winds down to its wrap, the animation takes one step. There
 * are two doors into that step: enter at the painter directly, or enter HERE, which first points
 * the register at the countdown cell so the painter's reseed lands on the correct address. This
 * priming door lets the one painter reseed ANIM_FRAME_COUNTER (0x8d41) through the primed pointer
 * and, from that same anchor, reach the phase counter that lives one address below it.
 *
 * ROM 0x0a25. Grounding: [seen].
 *
 * LIVE-OUT: memory only, and all of it produced by the painter this routine hands off to — this
 * routine writes no RAM of its own. Inherited from advanceAttractAnimationAndRepaint:
 *   - ANIM_FRAME_COUNTER (0x8d41) reseeded to the animation-tick period (0x0a video frames),
 *   - the attract-animation phase counter (0x8d40) advanced — its low two bits are the phase,
 *   - the two on-screen 2x2 tile blocks repainted with this phase's artwork.
 * Callers reach this only on the countdown wrap and never read a register back, so the contract
 * is purely RAM.
 */
export function primeAttractAnimAndPaintTileBlocks(m) {
  // Prime the animation cursor, then take one animation step. The pointer is aimed at
  // ANIM_FRAME_COUNTER (0x8d41) — the cell the painter reseeds first and then steps back from to
  // reach the phase counter (0x8d40) one address below it. With the cursor set, control continues
  // into advanceAttractAnimationAndRepaint, which reloads the countdown, advances the 4-phase
  // animation, and stamps this phase's tile artwork into both on-screen blocks. Returning that
  // result directly makes this a hand-off — nothing of this routine's own is left behind on the
  // way out; the painter's return goes straight to whoever called here.
  return advanceAttractAnimationAndRepaint(m, ANIM_FRAME_COUNTER);
}
