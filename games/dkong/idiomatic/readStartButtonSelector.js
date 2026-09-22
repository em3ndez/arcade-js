// SPDX-License-Identifier: GPL-3.0-only
/**
 * readStartButtonSelector — while credited, build a start-button mask and prompt index from the
 * credit count (one credit -> 0x04/string 9; else 0x0C/string 10), redraw the prompt once every
 * 8 frames, and return the input port's start bits masked to the allowed set.
 *
 * On the 1-in-8 draw frames the credit-display redraw zeroes the working mask, so the returned
 * selector is 0 there — faithful. LIVE-OUT: memory, plus the returned selector byte.
 */

import { CREDITS, FRAME, IN2_PORT } from "./names.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";

export function readStartButtonSelector(m) {
  const { regs, mem8 } = m;

  let mask, prompt;
  if (mem8[CREDITS] === 0x01) {
    mask = 0x04; // START1 only
    prompt = 0x09;
  } else {
    mask = 0x0c; // START1 | START2
    prompt = 0x0a;
  }

  if ((mem8[FRAME] & 0x07) === 0) {
    drawStringVertical(m, prompt);
    drawCreditDisplay(m);
    mask = 0; // the redraw clobbers the working mask, so the AND yields 0 on draw frames
  }

  return (regs.a = mem8[IN2_PORT] & mask); // port read kicks the watchdog
}
