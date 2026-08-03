// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCreditDisplay — paint the "CREDIT nn" line: the label plus the credit count.  ROM 0x0616.
 *
 * Two steps, both pure output:
 *
 *   1. Draw canned string 5 — the letters "CREDIT" — down its tilemap column via
 *      drawStringVertical (0x05E9). (String 5's characters decode to C-R-E-D-I-T from
 *      the ROM string table; string 4, for reference, is "HIGH SCORE".)
 *   2. Render the one-byte credit count CREDITS (0x6001, packed BCD) as its two digits
 *      into the display column at VRAM 0x74BF, stepping one tilemap row UP (-0x20)
 *      between the high and low digit, via expandBcdDigits (0x0583).
 *
 * The second step is reached by a TAIL JUMP in the oracle (`jp 0x0583`, not a call): so
 * expandBcdDigits' own `ret` returns to drawCreditDisplay's CALLER, and this routine has
 * no `ret` of its own. Modelled here as an ordinary JS return after the direct call — the
 * dropped Z80 stack becomes the JS call stack.
 *
 * Reached from the credit/title-screen display paths: entry_0611 (task-table entry 8,
 * gated on 0x6007 bit 0), loc_08d5 (the player-button prompt + credit line), loc_141e,
 * and sub_1486. In attract the credit count is 0, so the digits render as "00".
 *
 * Memory-equivalent to the frozen oracle — equivalence-0616.test.js.
 * GATE:     crafted-entry. Real captured 0x0616 dispatches (attract reaches it through
 *           the task queue) replayed oracle-vs-idiomatic on RAM (−STACK_SCRATCH) + pc +
 *           SP + live-out; plus crafted nonzero-credit arms (the digit values attract
 *           never varies off 0). Teeth: a wrong-source twin (renders the wrong byte as
 *           the count) and a wrong-string twin (draws string 4 not 5), both caught.
 * LIVE-OUT: memory + A + B + HL + IX + DE — the same register live-out expandBcdDigits
 *           declares, because this routine tail-jumps into it. Memory is the real output
 *           (the "CREDIT" glyph cells 0x74FF..0x759F and the two digit cells at
 *           0x74BF/0x749F). Of the registers, only B is genuinely consumed by a caller
 *           (loc_08d5's `and b`, which reads the B=0 the digit loop leaves); A/HL/IX/DE
 *           are dead ABI residue — reproduced and compared anyway as the strictly
 *           stronger tail-call contract, at no cost. Flags are dropped as dead. SP/pc are
 *           the dropped stack model: the JS return leaves them at entry, and the harness
 *           applies one m.ret() to line them up with the oracle's internal `ret`.
 * NAMES:    CREDITS (0x6001, ram.js) — the credit-count source byte. The string index
 *           (5), the digit-cell VRAM cursor (0x74BF), and the row step (-0x20) are ROM
 *           literals, not work-RAM, so they stay as local hex constants.
 */
import { CREDITS } from "./ram.js";
import { drawStringVertical } from "./drawStringVertical.js"; // ROM 0x05E9
import { expandBcdDigits } from "./expandBcdDigits.js"; //      ROM 0x0583

// -- ROM literals (baked into the code, NOT work-RAM, so none are in ram.js) --
const CREDIT_STRING_INDEX = 0x05; // "CREDIT" in the string table drawStringVertical reads
const CREDIT_DIGITS_VRAM = 0x74bf; //  VRAM cursor: high digit here, low digit one row up
const DIGIT_ROW_STEP = 0xffe0; //      -0x20: step one tilemap row up between the two digits

export function drawCreditDisplay(m) {
  const { regs } = m;

  // 1. Draw the "CREDIT" label (canned string 5), down its tilemap column.
  regs.a = CREDIT_STRING_INDEX;
  drawStringVertical(m);

  // 2. Render the credit count (0x6001, one packed-BCD byte) as two digits at 0x74BF.
  //    expandBcdDigits reads HL = source, IX = dest cursor, DE = per-digit stride,
  //    B = source-byte count. TAIL position: its return returns to this routine's caller.
  regs.hl = CREDITS;
  regs.de = DIGIT_ROW_STEP;
  regs.ix = CREDIT_DIGITS_VRAM;
  regs.b = 0x01; // one source byte -> two digits
  expandBcdDigits(m);
}
