// SPDX-License-Identifier: GPL-3.0-only
/**
 * addToSpriteObjectColumn — add one signed delta into the SAME field of all ten sprite-object
 * records at once. A shim over the general strided add hard-wiring stride 4 (one record) and
 * count 10; the caller supplies the field pointer and signed delta (first byte = X, +3 = Y).
 * The 8-bit add wraps. regs.de (the stride) is a live-out one caller reads back.
 */
import { addStrided } from "./addStrided.js";

export function addToSpriteObjectColumn(m, hl = m.regs.hl, c = m.regs.c) {
  // stride 4 (one record), count 10; regs.de is a live-out a caller reads back — addStrided
  // never touches de, so the write rides the return (same memory/register result).
  addStrided(m, c, 0x0004, 0x0a, hl);
  return [m.regs.de = 0x0004];
}
