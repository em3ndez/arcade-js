// SPDX-License-Identifier: GPL-3.0-only
/**
 * runRivetColorCycleBlink — the 100m rivet-board branch of the per-frame colour-cycle blink:
 * repaint two descending colour columns as one continuous run, then blink a decorative sprite pair
 * by the sweep counter's phase bit and Mario's screen half.
 *
 * LIVE-OUT: memory-only.
 */
import { MARIO_X } from "./names.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { blinkSpritePairByX } from "./blinkSpritePairByX.js";
import { paintColorColumnAndBlinkOff } from "./paintColorColumnAndBlinkOff.js";
import { blinkSpritePairOn } from "./blinkSpritePairOn.js";

const COLUMN_A_TOP = 0x7623;
const COLUMN_B_TOP = 0x7583;

const BASE_COLOR = 16; //        the first column's run start; the second column resumes it
const BRIGHT_BAND_COLOR = 223; // the brighter band the left-half arm repaints column A with

const SWEEP_PHASE_BIT = 0x40;
const RIGHT_HALF_X = 128; // Mario X screen-half split; >= is the right half

export function runRivetColorCycleBlink(m, c = m.regs.c) {
  const { regs, mem8 } = m;

  const sweepCounter = c;

  regs.a = BASE_COLOR;
  regs.hl = COLUMN_A_TOP;
  fillDescendingColumn(m);
  regs.hl = COLUMN_B_TOP; // value carries over from the first column (resumes at 13)
  fillDescendingColumn(m);

  if ((sweepCounter & SWEEP_PHASE_BIT) === 0) {
    blinkSpritePairByX(m);
    return;
  }

  if (mem8[MARIO_X] >= RIGHT_HALF_X) {
    paintColorColumnAndBlinkOff(m);
    return;
  }

  regs.a = BRIGHT_BAND_COLOR;
  regs.hl = COLUMN_A_TOP;
  fillDescendingColumn(m);
  blinkSpritePairOn(m);
}
