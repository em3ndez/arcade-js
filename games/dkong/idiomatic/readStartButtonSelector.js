// SPDX-License-Identifier: GPL-3.0-only
/**
 * readStartButtonSelector — read which allowed start button is pressed on the
 * credit screen, and once every 8 frames redraw the start prompt.
 *
 * Runs every frame while a game is CREDITED — coins are in, nobody has started yet.
 * It does three things:
 *
 *   (1) Builds a start-button MASK and a prompt-string index from the credit count:
 *       exactly one credit -> mask 0x04 (START1 only), prompt string 9; any other
 *       count -> mask 0x0C (START1|START2), prompt string 10. So a lone credit only
 *       honours the 1-player start, and the prompt on screen differs.
 *   (2) Once every 8 frames ((FRAME & 7) == 0) redraws the prompt: the prompt string
 *       first, then the CREDIT line. The other 7 frames skip straight to the read.
 *   (3) Returns the input port's start bits masked to the ones this credit count
 *       allows. The credit-screen state machine reads that byte: 0x04 starts a
 *       1-player game, 0x08 a 2-player game, anything else (0x00 or 0x0C) means keep
 *       waiting.
 *
 * Writes no work RAM of its own; the only stores are the two draws' video writes on
 * the 1-in-8 draw frames. A QUIRK worth knowing: on those frames the draws CLOBBER
 * the mask register before it is used, so the byte returned on a draw frame is the
 * port masked with whatever the draw left behind (0 in practice), not with the
 * 0x04/0x0C built at the top. That is reproduced deliberately by masking with the
 * LIVE register rather than with the built value. It is harmless because the state
 * machine acts only on a clean 0x04 / 0x08, which land on the 7-in-8 skip frames.
 *
 * LIVE-OUT: memory, plus the returned selector byte.
 */

import { CREDITS, FRAME } from "./names.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";

// The coin/start input port: bit2 = START1 (0x04), bit3 = START2 (0x08). READING it
// kicks the watchdog. A board input latch rather than work RAM, so it is a local.
const IN2 = 0x7d00;

export function readStartButtonSelector(m) {
  const { regs, mem } = m;

  // Build the start-button mask and the prompt-string index from the credit count.
  // Exactly one credit -> only START1 is honoured; otherwise both.
  if (mem.read8(CREDITS) === 0x01) {
    regs.b = 0x04; // START1 only
    regs.e = 0x09; // 1-player prompt string
  } else {
    regs.b = 0x0c; // START1 | START2
    regs.e = 0x0a; // 2-player prompt string
  }

  // Once every 8 frames, redraw the prompt string then the CREDIT line.
  if ((mem.read8(FRAME) & 0x07) === 0) {
    regs.a = regs.e; // the draw takes the string index in the accumulator
    drawStringVertical(m); // draw the prompt string
    drawCreditDisplay(m); // redraw the CREDIT line (also clobbers the mask register)
  }

  // Return the pressed start button(s), masked to the allowed set. The port read kicks
  // the watchdog. The mask is the LIVE register value: the built mask on skip frames,
  // whatever the draws left behind on draw frames.
  regs.a = mem.read8(IN2) & regs.b;
}
