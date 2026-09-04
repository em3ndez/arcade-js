// SPDX-License-Identifier: GPL-3.0-only
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { ATTRACT_BODY_SCREEN_ADDR } from "./names.js";

/**
 * typeAttractBlock — "type" a fixed 0x0f-byte attract block onto the screen at a paced cadence.
 *
 * WHAT IT IS
 *   Seats a 0x0f (15) glyph count and a fixed screen destination ATTRACT_BODY_SCREEN_ADDR, then runs the paced typing
 *   driver over the caller's source pointer DE. The driver draws one glyph and then waits a fixed
 *   number of vblank frames per byte, so the block appears to type itself onto the screen character by
 *   character rather than all at once.
 *
 * ROLE IN THE MACHINE
 *   Part of the attract sequence, called from loc_0aea. While no game is live the machine paces its
 *   animations off the interrupt heartbeat: typePacedSpriteRun (0x0a93) walks a per-byte typed script,
 *   drawing one glyph and waiting a fixed 7 vblank frames per byte on
 *   FRAME_DELAY_TIMER (0x20c0, decremented once per frame by the vblank body). This is a generator: it
 *   yields at each per-byte wait so the outer clock-free frame model can fire the interrupt between
 *   glyphs. ATTRACT_BODY_SCREEN_ADDR is the fixed screen destination for this block.
 *
 * ROM 0x0acf-0x0ad6.  Grounding: [seen].
 * LIVE-OUT: memory-only (the drawn glyphs); generator — yields per byte, then delegates its return.
 */
// Type a 0x0f-byte block to a fixed screen destination, using the caller's source pointer `de`.
// Generator; memory-only.
export function* typeAttractBlock(m, de) {
  // Delegate to the paced typing driver: source = de, count = 0x0f glyphs, destination = ATTRACT_BODY_SCREEN_ADDR.
  // yield* forwards each per-byte frame wait so the block types out one glyph per cadence window.
  yield* typePacedSpriteRun(m, de, 0x0f, ATTRACT_BODY_SCREEN_ADDR);
}
