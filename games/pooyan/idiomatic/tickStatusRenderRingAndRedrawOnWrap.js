// SPDX-License-Identifier: GPL-3.0-only
import { wrapRenderPhaseAndPaintTileTriplet } from "./wrapRenderPhaseAndPaintTileTriplet.js";
import { STATUS_RENDER_RING, STATUS_RENDER_PHASE } from "./names.js";
/**
 * tickStatusRenderRingAndRedrawOnWrap — the timing half of a slow-animation pump for a small
 * animated widget in the on-screen status area.
 *
 * ROM 0x23a1. Grounding: [seen].
 *
 * WHAT IT IS: a two-stage countdown that decides *when* the status widget is allowed to change
 * its picture. The widget must animate much slower than the display refreshes, so a single
 * per-frame subtract would flicker it far too fast. Instead the machine keeps two small counters
 * side by side in work RAM:
 *
 *   - STATUS_RENDER_RING  (0x88bd) — a fast counter that wraps every 8 ticks (mod 8).
 *   - STATUS_RENDER_PHASE (0x88bc) — a slow counter that wraps every 4 steps (mod 4) and names
 *                                    which of four pictures the widget currently shows.
 *
 * This routine ticks the fast ring once per visit. Seven visits out of every eight it simply
 * returns and the picture holds unchanged. On the eighth — when the ring wraps back to zero — it
 * "borrows" one from the slow phase counter (advancing the animation by one frame) and drops into
 * the shared render tail, which repaints the widget to match the new phase. The net effect is a
 * clean 8:1 gear-down: the widget advances one frame for every eight times this routine runs.
 *
 * ROLE IN THE MACHINE: this is the clock; wrapRenderPhaseAndPaintTileTriplet (ROM 0x23ad) is the
 * artist. Every visit passes through the clock, but the artist is reached only on a ring wrap, so
 * each repaint means "the phase just changed, redraw to match". The two counters live in adjacent
 * cells precisely so the wrap-and-borrow reads as one downward step through a two-cell counter.
 *
 * LIVE-OUT: none — a void tail. Every effect lands in memory: the ring counter and (on a wrap)
 * the phase counter are written back, and on a wrap the render tail repaints the status-area
 * video cells.
 */
const RING_MASK = 0x07; // ring counter wraps mod 8

export function tickStatusRenderRingAndRedrawOnWrap(m) {
  const { mem8 } = m;

  // STEP 1 — tick the fast ring counter and hold if it is still counting.
  // STATUS_RENDER_RING (0x88bd) is decremented and masked back into the range 0..7, so it cycles
  // 7,6,5,4,3,2,1,0,7,6,... one step per visit. The masked value is stored back so the ring stays
  // wrapped for the next visit. While the result is non-zero the widget is not due to change: the
  // caller returns and the picture on screen simply holds.
  const ring = (mem8[STATUS_RENDER_RING] - 1) & RING_MASK;
  mem8[STATUS_RENDER_RING] = ring;
  if (ring !== 0) return; // ring still counting -> hold

  // STEP 2 — the ring just wrapped: borrow one from the slow phase counter.
  // Reaching here means STATUS_RENDER_RING hit zero, i.e. a full ring elapsed. Decrementing
  // STATUS_RENDER_PHASE (0x88bc) advances the animation by exactly one frame. It is left unmasked
  // here on purpose — the render tail clamps it to 0..3 before using it as a table index, which is
  // what keeps the four-frame animation looping instead of running off the descriptor table.
  mem8[STATUS_RENDER_PHASE] = mem8[STATUS_RENDER_PHASE] - 1; // borrow into the phase

  // STEP 3 — fall into the shared render tail to repaint the widget for the new phase.
  // The phase cell itself (0x88bc) is handed across as the phase pointer, so the tail clamps and
  // reads the very counter this routine just stepped, then stamps the three 2x2 blocks that make
  // up the widget into the status-area video RAM.
  return wrapRenderPhaseAndPaintTileTriplet(m, STATUS_RENDER_PHASE); // fall into the shared render tail
}
