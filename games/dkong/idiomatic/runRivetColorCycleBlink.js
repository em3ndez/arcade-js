// SPDX-License-Identifier: GPL-3.0-only
/**
 * runRivetColorCycleBlink — the 100m rivet-board branch of the per-frame colour-cycle
 * blink driver: repaint two decorative colour columns, then blink a pair of sprites by
 * the sweep phase and Mario's screen half.  ROM 0x04be.
 *
 * Once per frame the colour tail loc_0486 stages a sweep counter (0x6390) and a one-row
 * colour-RAM stride, and — only on the rivet board (BOARD 0x6227 == 4) — hands off here.
 * This routine always does the same two things first, then routes three ways:
 *
 *   1. Repaint two 3-cell descending colour columns. The first starts at colour code 16
 *      and lays 16/15/14 down column A (top 0x7623); the second continues the SAME
 *      descending run — resuming from the value the first column left (13) — laying
 *      13/12/11 down column B (top 0x7583). Both step one tilemap row apart (the stride is
 *      a live-in from the driver, one row in play), so the pair reads as one continuous
 *      six-step colour gradient that cycles as the sweep counter advances.
 *
 *   2. Blink the decorative sprite pair (sprite-buffer records 0 and 1, code bytes 0x6901
 *      and 0x6905) by the sweep counter's phase bit and where Mario is:
 *        - phase bit clear  -> blink the pair purely by Mario's screen half, no extra
 *          repaint (blinkSpritePairByX: right half off, left half on).
 *        - phase bit set, Mario on the RIGHT half  -> repaint column B in the brighter band
 *          and force the pair's blink OFF (paintColorColumnAndBlinkOff).
 *        - phase bit set, Mario on the LEFT half   -> repaint column A in the brighter band
 *          (starting at colour code 223: 223/222/221) and force the pair's blink ON.
 *
 * Every callee is already idiomatic, so the whole hand-off tree is direct calls with no
 * register-ABI marshalling. Writes only the six colour cells (a third of them repainted on
 * two of the arms) and the two sprite code bytes; reads Mario's X plus the two register
 * live-ins (the sweep counter and the stride) threaded straight through to the callees.
 *
 * Memory-equivalent to the frozen oracle — equivalence-04be.test.js.
 * GATE:     crafted-entry — NOT reached in attract (0 dispatches over the capture run: the
 *           rivet board is cold in a 25m attract). Realism comes from crafted entries reposed
 *           on real captured colour-cycle bases (hook the reached sibling 0x04a3, which
 *           carries a genuine colour page, sprite buffer, sweep counter and one-row stride),
 *           each on a FRESH clone (this routine writes memory), over a matrix of sweep-phase,
 *           Mario's X (both halves + the exact boundary), and the two sprite code bytes — so
 *           all three arms and both blink sub-arms run — plus a non-one-row stride pinning the
 *           stride is honoured end to end and a toggle-phase counter. Whole contract each time:
 *           RAM − STACK_SCRATCH + pc + SP. Teeth: a wrong-phase-bit twin, a boundary-flipped
 *           X twin, and a dropped-second-column twin — one per decision point, all caught.
 * LIVE-OUT: memory-only — the six colour cells (0x7623/0x7643/0x7663 and 0x7583/0x75A3/0x75C3
 *           at the one-row stride) and the sprite code bytes 0x6901/0x6905. No live registers
 *           or flags: the hand-off chain returns up through loc_0486 to a caller that reads no
 *           register before overwriting it, so the oracle's residual registers/flags are dead
 *           ABI. RESIDUAL REGISTER ABI: the sweep counter and the stride are read-only live-ins
 *           that stay on the machine because the (still register-based) idiomatic callees read
 *           them there — noted for the honest-signature capstone. SP/PC are the single net
 *           return the JS call stack replaces (the harness supplies one return to line them up).
 * NAMES:    MARIO_X (0x6203) from ram.js — the player X the branch reads. The colour-RAM column
 *           tops (0x7623/0x7583) and the sprite code bytes (owned by the blink callees) stay
 *           hex; the sweep counter (0x6390) and the one-row stride are caller-supplied live-ins.
 */
import { MARIO_X } from "../optimized/ram.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js"; // ROM 0x0514
import { blinkSpritePairByX } from "./blinkSpritePairByX.js"; // ROM 0x0509
import { paintColorColumnAndBlinkOff } from "./paintColorColumnAndBlinkOff.js"; // ROM 0x04f1
import { blinkSpritePairOn } from "./blinkSpritePairOn.js"; // ROM 0x04e1

// Tops of the two decorative colour-RAM columns (video RAM, 0x7400–0x77FF). Each fill steps
// down by the live-in one-row stride; column A is also repainted by the left-half arm.
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
  // into the blink callees, so it stays on the machine untouched.
  const sweepCounter = regs.c;

  // 1. Repaint the two colour columns as one continuous descending run: the second column
  //    resumes from the value the first left, so the six cells step 16..11 down the page.
  regs.a = BASE_COLOR;
  regs.hl = COLUMN_A_TOP;
  fillDescendingColumn(m); // 0x7623/0x7643/0x7663 = 16/15/14
  regs.hl = COLUMN_B_TOP; //  value carries over from the first column (resumes at 13)
  fillDescendingColumn(m); // 0x7583/0x75A3/0x75C3 = 13/12/11

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
  fillDescendingColumn(m); // 0x7623/0x7643/0x7663 = 223/222/221
  blinkSpritePairOn(m);
}
