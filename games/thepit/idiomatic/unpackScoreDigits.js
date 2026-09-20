// SPDX-License-Identifier: GPL-3.0-only
/**
 * unpackScoreDigits — expand a staged packed score value into display digit cells.
 *
 * The score-readout formatter stages the packed value at SCORE_DISPLAY_HIGH / SCORE_DISPLAY_LOW and
 * points a buffer at the record's digit cells. This splits it into four single-digit cells,
 * most-significant first, then two trailing zero cells (the implicit "00" never stored). A zero top
 * digit is blanked — the first cell is skipped and the run shifts down one, so five cells write
 * instead of six. The incoming register is the buffer pointer; the advanced pointer goes back the
 * same way, resting on the LAST cell written (the final store does not advance), which the caller relies on.
 */

import { SCORE_DISPLAY_HIGH, SCORE_DISPLAY_LOW } from "./names.js";
import { u16 } from "../../../core/int.js";
export function unpackScoreDigits(m, ptr = m.regs.hl) {
  const { mem8 } = m;

  const hi = mem8[SCORE_DISPLAY_HIGH];
  const lo = mem8[SCORE_DISPLAY_LOW];

  // The four value nibbles most-significant first, then two trailing zero cells.
  const cells = [hi >> 4, hi & 0x0f, lo >> 4, lo & 0x0f, 0, 0];

  // Leading-zero blanking: a zero top digit is skipped, shifting the run down one.
  const start = cells[0] === 0 ? 1 : 0;

  for (let i = start; i < cells.length; i++) {
    mem8[ptr] = cells[i];
    // Advance after every cell except the last — the pointer is left resting on it.
    if (i < cells.length - 1) ptr = u16(ptr + 1);
  }
  return (m.regs.hl = ptr);
}
