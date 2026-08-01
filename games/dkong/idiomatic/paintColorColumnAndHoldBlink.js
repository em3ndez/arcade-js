// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnAndHoldBlink — the colour-cycle blink driver's "leave-as-is" arm:
 * repaint sprite record #1's colour-RAM column, then commit its sprite code unchanged.
 * ROM 0x04a3.
 *
 * The state-0 colour-cycle driver runs a per-frame sweep counter (0x6390) and, from its
 * tail loc_0486, routes to one of a handful of arms by board and counter phase. This is
 * the plain, non-rivet arm (taken when BOARD != 4): it does two things and returns.
 *
 *   1. Repaint a colour-RAM column. It points HL at 0x75C4 and hands sub_0514
 *      (fillDescendingColumn) a 3-cell descending fill — laying A, A-1, A-2 into
 *      0x75C4, 0x75C4+DE, 0x75C4+2·DE. Both the fill VALUE (A) and the STRIDE (DE) are
 *      live-in from loc_0486: A is 0x10 or 0xEF depending on the sweep-counter phase,
 *      and DE is the one-tilemap-row stride 0x0020 it loads. So in practice this paints
 *      a 3-tile vertical colour cell one row apart, cycling between the two attribute
 *      bytes as the sweep counter advances.
 *
 *   2. Hold the sprite's blink state. It reloads sprite record #1's CURRENT code byte
 *      (0x6905) and falls into the shared blink-store tail loc_04ac (storeBlinkSpriteCode).
 *      Unlike the sibling arms — loc_04e1 "blink ON" (OR 0x80) and loc_04f9 "blink OFF"
 *      (AND 0x7F) — this arm passes the code through UNCHANGED, so it never sets or clears
 *      the flip/visibility bit; the shared tail may still apply its once-per-sweep low-2-bit
 *      tile toggle (driven by the counter staged in C).
 *
 * Both callees are already idiomatic, so the marshalling dissolves into two direct calls
 * with no register-ABI plumbing. Writes exactly four cells (the three colour cells and
 * 0x6905); reads A / DE / C live-in and 0x6905.
 *
 * Memory-equivalent to the frozen oracle — equivalence-04a3.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (the live non-rivet shape
 *           HL=0x75C4 A=0x10 DE=0x20 that loc_0486 feeds), plus crafted entries for the
 *           A=0xEF sweep-phase fill value and the once-per-sweep tile-toggle store phase
 *           ((C & 0x47) == 0x40) that a short attract need not reach, plus a non-0x20
 *           stride pinning that DE is honored. Not exhaustive (the input is
 *           target-memory × A × DE × C). Reached in attract on boards 1–3 via loc_0486.
 *           Teeth: a wrong-column twin (paints 0x75C0) and an always-toggle twin (XORs
 *           0x6905 ignoring the phase gate) — both caught on sentinel-painted targets.
 * LIVE-OUT: memory-only — the three colour cells (0x75C4/0x75E4/0x7604 at the DE=0x20
 *           stride) and sprite code 0x6905. No live registers/flags: the exit tail
 *           loc_04ac (storeBlinkSpriteCode) is itself memory-only and its caller loc_197a
 *           immediately calls the next routine without reading A/B/C/F, so the oracle's
 *           residual registers are dead ABI. SP/PC are the `ret` bookkeeping the JS call
 *           stack replaces.
 * NAMES:    SPRITE_BUFFER (0x6900) from ram.js — 0x6905 is record #1's code byte (+5).
 *           0x75C4 (colour-RAM column top), the fill value A (0x10/0xEF), the stride DE
 *           (0x20), and the sweep counter C (0x6390, SHARED with the how-high interlude)
 *           are all caller-supplied by loc_0486; 0x75C4 and 0x6390 stay hex, here only.
 */
import { SPRITE_BUFFER } from "./ram.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

// Top of the colour-RAM column this arm repaints; the fill steps down by DE (0x20).
const COLOR_COLUMN_TOP = 0x75c4;
// Record #1's code byte inside the sprite shadow buffer: base + 4 (record 1) + 1 (code).
const SPRITE1_CODE = SPRITE_BUFFER + 5; // 0x6905

export function paintColorColumnAndHoldBlink(m) {
  const { regs, mem } = m;

  // 1. Repaint the 3-cell descending colour column at 0x75C4. The fill value (A) and
  //    stride (DE) are live-in from loc_0486; this only sets the start pointer.
  regs.hl = COLOR_COLUMN_TOP; // ld hl,0x75c4
  fillDescendingColumn(m); // call sub_0514

  // 2. Reload sprite record #1's current code byte and hand it, UNCHANGED, to the shared
  //    blink-store tail — the arm that leaves the flip/visibility bit exactly as it was.
  regs.a = mem.read8(SPRITE1_CODE); // ld a,(0x6905)
  storeBlinkSpriteCode(m); // fall into loc_04ac
}
