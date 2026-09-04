// SPDX-License-Identifier: GPL-3.0-only
import { FRAME_DELAY_TIMER } from "./names.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { u8, u16 } from "../../../core/int.js";

/**
 * typePacedSpriteRun — draw a run of glyphs one at a time with the attract-screen "typing" cadence.
 *
 * WHAT IT IS
 *   A generator that walks `c` sprite ids from source `de`, blitting each as an 8-row glyph column at
 *   screen dest `hl` (which advances), and pausing a fixed number of displayed frames between glyphs
 *   so the text appears to type itself on.
 *
 * ROLE IN THE MACHINE
 *   While no game is live the machine paces its attract animations off the frame counter
 *   FRAME_DELAY_TIMER (0x20c0), which the vblank interrupt loc_0010 decrements once per displayed
 *   frame (see mechanisms.md "Frame tasks, timers, boot, and scoring"). This routine is the typed-text
 *   effect: for each id it draws the glyph through drawSprite8x8 (which returns HL advanced one glyph
 *   down the line so the run reads as a line of text), then seats FRAME_DELAY_TIMER to 7 and spins,
 *   yielding once per frame, until the interrupt has drained the counter — a fixed 7-frame gap per
 *   glyph. It is a generator because each pace step is a real frame boundary (one yield = one frame);
 *   the interrupt does the counting while it is suspended. Args are threaded explicitly rather than
 *   read from registers by default because a generator's parameter-default reads are not exempt from
 *   the layer's cruft gate.
 *
 * ROM 0x0a93.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (glyphs blitted, FRAME_DELAY_TIMER left at 1 from the last pace). Locals hold
 * the advancing source/dest/count; nothing is written back to the register file.
 */
export function* typePacedSpriteRun(m, de, c, hl) {
  // Local cursors: source id pointer, remaining count, and the advancing screen destination.
  let src = de;
  let count = c;
  let dst = hl;
  for (;;) {
    // Draw the current glyph; drawSprite8x8 returns the destination stepped one glyph-cell down the
    // line, which becomes the destination for the next id.
    dst = drawSprite8x8(m, m.mem8[src], dst);
    // Seat the 7-frame pace and wait it out: the vblank ISR decrements FRAME_DELAY_TIMER each frame;
    // yielding hands control back so the interrupt can run between checks.
    m.mem8[FRAME_DELAY_TIMER] = 0x07;
    while (u8(m.mem8[FRAME_DELAY_TIMER] - 1) !== 0) yield; // pace until the counter reaches 1
    // Advance to the next id and count this glyph off; stop once the run is exhausted.
    src = u16(src + 1);
    count = u8(count - 1);
    if (count === 0) break;
  }
}
