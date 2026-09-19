// SPDX-License-Identifier: GPL-3.0-only
/**
 * scrollClimbGraphicStep — slide one indexed pair of playfield cells up a row and step the
 * intro cutscene's scroll index down.
 *
 * LIVE-OUT: memory-only — the two copied video bytes and the decremented scroll index.
 */

import { copyByteDisplaced } from "./copyByteDisplaced.js";
import {
  INTRO_SCROLL_INDEX,
  VRAM_ROW_STEP_UP,
} from "./names.js";


export function scrollClimbGraphicStep(m) {
  const { regs, mem8 } = m;

  regs.bc = mem8[INTRO_SCROLL_INDEX];
  regs.de = VRAM_ROW_STEP_UP; // set once, reused by both copies

  copyByteDisplaced(m, 0x7600);
  copyByteDisplaced(m, 0x75c0);

  mem8[INTRO_SCROLL_INDEX] = (mem8[INTRO_SCROLL_INDEX] - 1);
}
