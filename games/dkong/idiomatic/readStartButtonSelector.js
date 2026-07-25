// SPDX-License-Identifier: GPL-3.0-only
/**
 * readStartButtonSelector — read which allowed start button is pressed on the
 * credit screen, and once every 8 frames redraw the start prompt.  ROM 0x08D5.
 *
 * Dispatched every frame while a game is CREDITED (from the vblank NMI's game-state
 * handler, by both sub-state arms — loc_08ba falls through into it, loc_08f8 calls
 * it). It does three things:
 *
 *   (1) Builds a start-button MASK in B and a prompt-string index in E from the
 *       credit count: exactly one credit -> B = 0x04 (START1 only), E = 0x09; any
 *       other count -> B = 0x0C (START1|START2), E = 0x0A. So a lone credit only
 *       honours the 1-player start, and the prompt string differs.
 *   (2) Once every 8 frames ((FRAME & 7) == 0) redraws the prompt: the prompt
 *       string (index E) via drawStringVertical, then the CREDIT line via
 *       drawCreditDisplay. The other 7 frames skip straight to the read.
 *   (3) Returns A = IN2 & B — the pressed start button(s), masked to the ones this
 *       credit count allows. The caller loc_08f8 tests A: 0x04 -> 1-player start,
 *       0x08 -> 2-player start, else (0x00 / 0x0C) -> wait.
 *
 * Writes no work RAM of its own; the only stores are the two draw callees' VRAM
 * writes on the 1-in-8 draw frames. On those frames the callees CLOBBER B before
 * the final `and b`, so the returned A is IN2 & the-callee-left-B (observed 0) —
 * a faithful oracle quirk preserved by masking with the LIVE regs.b, never the
 * 0x04/0x0C built at the top. loc_08f8 tolerates it: it acts only on a clean
 * 0x04 / 0x08, which land on the 7-in-8 skip frames.
 *
 * Memory-equivalent to the frozen oracle — equivalence-08d5.test.js.
 * GATE:     strict (memory-equivalence). Two driven coins reach BOTH the 1-credit
 *           (B=0x04) and >1-credit (B=0x0C) arms and both the draw and skip frames;
 *           + crafted start-pressed arms make the built mask observable in A; + teeth.
 * LIVE-OUT: memory + A (the returned selector byte IN2 & B). Flags are dead —
 *           loc_08f8 overwrites F with `cp 0x04` before reading, and the fall-through
 *           path returns A to the NMI dispatch, which branches on no flag it set.
 *           B/E are internal (E feeds the draw; B feeds the final mask).
 * NAMES:    CREDITS (0x6001), FRAME (0x601a) from ram.js. IN2 (0x7D00) is the
 *           coin/start input port — a board input latch, not work RAM, and reading
 *           it kicks the watchdog — so it stays a hex local, like FLIPSCREEN.
 */

import { CREDITS, FRAME } from "../optimized/ram.js";
import { drawStringVertical } from "./drawStringVertical.js"; // ROM 0x05E9
import { drawCreditDisplay } from "./drawCreditDisplay.js"; //   ROM 0x0616

// IN2 (0x7D00): the coin/start input port. bit2 = START1 (0x04), bit3 = START2
// (0x08). READING it kicks the watchdog (boards/dkong/io.js readIn2). A board
// input latch, not work RAM, so it stays hex/local like FLIPSCREEN.
const IN2 = 0x7d00;

export function readStartButtonSelector(m) {
  const { regs, mem } = m;

  // Build the start-button mask (B) and prompt-string index (E) from the credit
  // count. Exactly one credit -> only START1 is honoured; otherwise both.
  if (mem.read8(CREDITS) === 0x01) {
    regs.b = 0x04; // START1 only
    regs.e = 0x09; // 1-player prompt string
  } else {
    regs.b = 0x0c; // START1 | START2
    regs.e = 0x0a; // 2-player prompt string
  }

  // Once every 8 frames, redraw the prompt string (index E) then the CREDIT line.
  if ((mem.read8(FRAME) & 0x07) === 0) {
    regs.a = regs.e; // the draw callee takes the string index in A
    drawStringVertical(m); // draw the prompt string
    drawCreditDisplay(m); // redraw the CREDIT line (also clobbers B)
  }

  // Return A = IN2 & B — the pressed start button(s), masked to the allowed set.
  // The IN2 read kicks the watchdog. B is the live value: the built mask on skip
  // frames, the callee-left value on draw frames.
  regs.a = mem.read8(IN2) & regs.b;
}
