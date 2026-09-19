// SPDX-License-Identifier: GPL-3.0-only
/**
 * readStartButtonSelector — while credited, build a start-button mask and prompt index from the
 * credit count (one credit -> 0x04/string 9; else 0x0C/string 10), redraw the prompt once every
 * 8 frames, and return the input port's start bits masked to the allowed set.
 *
 * The mask register is the LIVE value: on draw frames the draws clobber it to 0, faithful/harmless.
 * LIVE-OUT: memory, plus the returned selector byte.
 */

import { CREDITS, FRAME } from "./names.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";

// Coin/start input port: bit2 = START1 (0x04), bit3 = START2 (0x08). Reading it kicks the
// watchdog — a board input latch, not work RAM.
const IN2 = 0x7d00;

export function readStartButtonSelector(m) {
  const { regs, mem, mem8 } = m;

  let prompt; // string index — scratch, consumed by the redraw; not a live-out
  if (mem8[CREDITS] === 0x01) {
    regs.b = 0x04; // START1 only
    prompt = 0x09; // 1-player prompt string
  } else {
    regs.b = 0x0c; // START1 | START2
    prompt = 0x0a; // 2-player prompt string
  }

  if ((mem8[FRAME] & 0x07) === 0) {
    drawStringVertical(m, prompt);
    drawCreditDisplay(m); // clobbers the mask register (regs.b) to 0 via m.regs — faithful
  }

  // regs.b stays m.regs: drawCreditDisplay zeroes it on draw frames, so the AND gives 0 there.
  return (regs.a = mem.read8(IN2) & regs.b); // port read kicks the watchdog
}
