// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnAndBlinkOff — the rivet-board colour-cycle arm: preset the fill code to
 * 0xEF, paint the 3-cell descending colour column at 0x7583, then blink the decorative
 * sprite pair OFF. ROM 0x04f1.
 *
 * On the 100m rivet board (BOARD == 4) the colour-cycle blink block loc_04be repaints two
 * colour-RAM columns and then routes by the sweep-counter bit and Mario's X. This routine is
 * the X >= 0x80 arm (loc_04be's `jp nc,0x04f1`). It does two things and returns:
 *
 *   1. Paint a colour-RAM column. It presets A = 0xEF (`ld a,0xef`) and points HL at 0x7583
 *      (`ld hl,0x7583`), then hands sub_0514 (fillDescendingColumn) a 3-cell descending fill
 *      — laying 0xEF, 0xEE, 0xED into 0x7583, 0x7583+DE, 0x7583+2·DE. The STRIDE (DE) is
 *      live-in from the colour-cycle driver loc_0486, which loads the one-tilemap-row stride
 *      0x0020, so in practice the cells are 0x7583 / 0x75A3 / 0x75C3 — a 3-tile vertical
 *      colour cell one row apart, cycling colour as the sweep advances.
 *
 *   2. Blink the sprite pair OFF. It FALLS THROUGH into loc_04f9 (blinkSpritePairOff), which
 *      forces bit 7 (the flip/visibility bit) clear on both decorative sprites' code bytes
 *      0x6901 and 0x6905 — record 0 committed directly, record 1 through the shared store
 *      tail storeBlinkSpriteCode (0x04ac), which may still apply its once-per-sweep low-2-bit
 *      tile toggle keyed on the colour counter staged in C.
 *
 * Both callees are already idiomatic, so the oracle's `call 0x0514` + fall-into-0x04f9 chain
 * dissolves into two direct calls with no register-ABI marshalling. Writes exactly five cells
 * (the three colour cells and 0x6901 / 0x6905); reads DE and C live-in and 0x6901 / 0x6905.
 *
 * Memory-equivalent to the frozen oracle — equivalence-04f1.test.js.
 * GATE:     crafted-entry — NOT reached in attract (0 dispatches over the capture run: the
 *           rivet board and the X >= 0x80 arm are cold in a 25m attract). Realism comes from
 *           crafted entries reposed on real captured colour-cycle bases (hook the reached
 *           sibling 0x04a3), each on a FRESH clone (this routine writes memory): the live
 *           DE = 0x20 shape over a matrix of (0x6901, 0x6905, C), plus crafted entries for
 *           the once-per-sweep tile-toggle store phase ((C & 0x47) == 0x40) and a non-0x20
 *           stride that pins DE is honored end-to-end. Whole contract each time: RAM −
 *           STACK_SCRATCH + pc + SP. Teeth: a wrong-column twin (paints 0x7580) and a
 *           blink-ON twin (OR 0x80 instead of AND 0x7F) — one per half, both caught.
 * LIVE-OUT: memory-only — the three colour cells (0x7583 / 0x75A3 / 0x75C3 at the DE = 0x20
 *           stride) and sprite code bytes 0x6901, 0x6905. No live registers/flags: the exit
 *           tail storeBlinkSpriteCode is memory-only and its caller (loc_197a, top of the
 *           blink chain) calls the next routine without reading A/B/C/F, so the oracle's
 *           residual A/HL/B (from the fill) and A (from the blink-off store) are dead ABI.
 *           DE and C are read-only live-in, passed straight through to the callees on `m`
 *           (the two callees are still register-based, so DE/C stay a residual register ABI
 *           here — noted for the honest-signature capstone). SP/PC are the single net `ret`
 *           the JS call stack replaces (the harness supplies one m.ret() to line them up).
 * NAMES:    none imported — this routine references no work-RAM address of its own. 0xEF is an
 *           immediate; 0x7583 is a colour-RAM (video RAM, 0x7400–0x77FF) column top; the
 *           0x6901 / 0x6905 sprite-buffer addresses are owned by the blink-off arm it falls
 *           into (blinkSpritePairOff's own file). 0x7583 and 0x04f1 stay hex, here only.
 */
import { fillDescendingColumn } from "./fillDescendingColumn.js"; // ROM 0x0514
import { blinkSpritePairOff } from "./blinkSpritePairOff.js"; // ROM 0x04f9

// Top of the colour-RAM column this arm repaints; the fill steps down by DE (0x20 in play).
const COLOR_COLUMN_TOP = 0x7583;

export function paintColorColumnAndBlinkOff(m) {
  const { regs } = m;

  // ld a,0xef ; ld hl,0x7583 — preset the descending colour-column fill (value + start).
  regs.a = 0xef;
  regs.hl = COLOR_COLUMN_TOP;

  // call 0x0514 — paint the 3-cell descending colour column (0xEF, 0xEE, 0xED) at 0x7583.
  // The stride DE is live-in (0x20 in play) and passes straight through on `m`.
  fillDescendingColumn(m);

  // fall into loc_04f9 — blink OFF: clear bit 7 of records 0 and 1 (0x6901, 0x6905), record 1
  // through the shared store tail keyed on the colour counter C (live-in, passes through).
  blinkSpritePairOff(m);
}
