// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { precheckCollisionBounds } from "./precheckCollisionBounds.js";
import { loc_5f02 } from "./loc_5f02.js";
import { FLASH_CELL_BASE } from "./names.js";
/**
 * loc_5f11 — scan B actor slots for a proximity hit against a target box.
 *
 * Each pass reads the slot's state byte (the paired records walk by their strides); empty (0) and
 * already-struck (3) slots are skipped. A live slot is measured by the bounds precheck, which
 * yields the biased screen X, the biased Y, and an on-screen flag; off-screen slots are skipped.
 * A hit needs the horizontal gap versus the target centre under seven and the vertical gap versus
 * the target centre plus a margin under six. On a hit the slot is marked struck, the
 * interrupt-parity flash cell is set, and the routine tail-hands to the hit-sound enqueue. With no
 * hit it advances and loops until the counter reaches zero.
 *
 * LIVE-OUT: memory only — the struck slot, the flash cell, and the enqueue's ring writes.
 */

const STATE_STRUCK = 0x03;
const DX_LIMIT = 0x07;
const DY_LIMIT = 0x06;
const Y_MARGIN = 0x08;
const IX_STRIDE = 0x04;
const HL_STRIDE = 0x18;

/** Absolute value of an 8-bit subtraction result given whether the subtract borrowed. */
function absDiff(raw, borrow) {
  return borrow ? (-raw) & 0xff : raw;
}

export function loc_5f11(m, count = m.regs.b, ix = m.regs.ix, hl = m.regs.hl, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  let recA = ix;
  let recB = hl;
  let remaining = count;

  for (;;) {
    const state = mem8[recB];
    if (state !== 0 && state !== STATE_STRUCK) {
      const [e, y, onScreen] = precheckCollisionBounds(m, recA);
      if (onScreen) {
        const dx = absDiff((mem8[iy] - e) & 0xff, mem8[iy] < e);
        if (dx < DX_LIMIT) {
          const yTarget = (mem8[iy + 2] + Y_MARGIN) & 0xff;
          const dy = absDiff((yTarget - y) & 0xff, yTarget < y);
          if (dy < DY_LIMIT) {
            mem8[recB] = STATE_STRUCK;
            mem8[FLASH_CELL_BASE + (ireg !== 0 ? 1 : 0)] = 0x01; // interrupt parity picks the cell
            return loc_5f02(m);
          }
        }
      }
    }
    recA = u16(recA + IX_STRIDE);
    recB = u16(recB + HL_STRIDE);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) return;
  }
}
