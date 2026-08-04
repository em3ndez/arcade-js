// SPDX-License-Identifier: GPL-3.0-only
/**
 * runRivetColorCycleBlink — the 100m rivet-board branch of the per-frame colour-cycle
 * blink: repaint two decorative colour columns, then blink a pair of sprites by the sweep
 * phase and Mario's screen half.
 *
 * Once per frame the colour-cycle driver stages a sweep counter and a one-row colour-RAM
 * stride and — only on the rivet board — hands off here. This routine always does the same
 * two things first, then routes three ways:
 *
 *   1. Repaint two 3-cell descending colour columns. The first starts at colour code 16 and
 *      lays 16/15/14 down column A; the second continues the SAME descending run — resuming
 *      from the value the first column left (13) — laying 13/12/11 down column B. Both step
 *      one tilemap row apart (the stride is a live-in from the driver, one row in play), so
 *      the pair reads as one continuous six-step colour gradient that cycles as the sweep
 *      counter advances.
 *
 *   2. Blink the decorative sprite pair (the first two records of the sprite buffer) by the
 *      sweep counter's phase bit and where Mario is:
 *        - phase bit clear -> blink the pair purely by Mario's screen half, no extra repaint
 *          (right half off, left half on).
 *        - phase bit set, Mario on the RIGHT half -> repaint column B in the brighter band
 *          and force the pair's blink OFF.
 *        - phase bit set, Mario on the LEFT half -> repaint column A in the brighter band
 *          (starting at colour code 223: 223/222/221) and force the pair's blink ON.
 *
 * Writes only the six colour cells (a third of them repainted on two of the arms) and the two
 * sprite code bytes; reads Mario's X plus the two live-ins (the sweep counter and the stride),
 * which are threaded straight through to the fill and blink helpers.
 *
 * LIVE-OUT: memory-only.
 */
import { MARIO_X } from "./names.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { blinkSpritePairByX } from "./blinkSpritePairByX.js";
import { paintColorColumnAndBlinkOff } from "./paintColorColumnAndBlinkOff.js";
import { blinkSpritePairOn } from "./blinkSpritePairOn.js";

// Tops of the two decorative colour-RAM columns. Each fill steps down by the live-in one-row
// stride; column A is also repainted by the left-half arm.
const COLUMN_A_TOP = 0x7623;
const COLUMN_B_TOP = 0x7583;

// Descending colour-attribute run start values (each fill writes v, v-1, v-2).
const BASE_COLOR = 16; //        the first column's run start; the second column resumes it
const BRIGHT_BAND_COLOR = 223; // the brighter band the left-half arm repaints column A with

const SWEEP_PHASE_BIT = 0x40; // bit 6 of the per-frame sweep counter — the slow blink phase
const RIGHT_HALF_X = 128; //     Mario X screen-half split; >= is the right half

export function runRivetColorCycleBlink(m) {
  const { regs, mem } = m;

  // The sweep counter and the stride are live-ins from the driver; the counter also flows on
  // into the blink step, so it stays on the machine untouched.
  const sweepCounter = regs.c;

  // 1. Repaint the two colour columns as one continuous descending run: the second column
  //    resumes from the value the first left, so the six cells step 16..11 down the page.
  regs.a = BASE_COLOR;
  regs.hl = COLUMN_A_TOP;
  fillDescendingColumn(m); // column A: 16/15/14
  regs.hl = COLUMN_B_TOP; //  value carries over from the first column (resumes at 13)
  fillDescendingColumn(m); // column B: 13/12/11

  // 2. Route the decorative sprite-pair blink.
  if ((sweepCounter & SWEEP_PHASE_BIT) === 0) {
    // Phase low: blink purely by Mario's screen half, no further repaint.
    blinkSpritePairByX(m);
    return;
  }

  if (mem.read8(MARIO_X) >= RIGHT_HALF_X) {
    // Phase high, Mario on the right: repaint column B brighter and blink the pair OFF.
    paintColorColumnAndBlinkOff(m);
    return;
  }

  // Phase high, Mario on the left: repaint column A brighter, then blink the pair ON.
  regs.a = BRIGHT_BAND_COLOR;
  regs.hl = COLUMN_A_TOP;
  fillDescendingColumn(m); // column A again: 223/222/221
  blinkSpritePairOn(m);
}
