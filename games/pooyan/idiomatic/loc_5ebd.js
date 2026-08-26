// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { precheckCollisionBounds } from "./precheckCollisionBounds.js";
import { loc_5f06 } from "./loc_5f06.js";
import { loc_5f02 } from "./loc_5f02.js";
import { loc_0010 } from "./loc_0010.js";
import { STRUCK_TARGET_LATCH } from "./names.js";
/**
 * loc_5ebd — one iteration of the actor-sweep loop body.
 *
 * Skips the slot when its lead byte is empty or its state byte has reached the busy threshold. A
 * live slot is measured by the bounds precheck (biased screen X/Y plus an on-screen flag);
 * off-screen slots are skipped. A hit needs the horizontal gap versus the target centre under its
 * limit and the vertical gap versus the target centre plus a margin under its limit. Any miss hands
 * to the loop tail. On a hit the slot is caught (lead cleared, 01/08 stamped), the struck target is
 * reloaded, and — unless that target's flag byte bit0 is already set — its record is zero-filled
 * before tail-handing to the hit-sound enqueue. LIVE-OUT: memory only (the caught slot, the
 * zero-filled target, the enqueue's ring writes); the loop cursors handed to the tail are dead.
 */

const STATE_LIMIT = 0x04; // slot state byte >= this -> busy, skip
const DX_LIMIT = 0x0a;
const DY_LIMIT = 0x09;
const Y_MARGIN = 0x08;
const TARGET_FLAG_OFFSET = 0x07; // struck target flag byte; bit0 set -> skip the fill
const TARGET_FILL_LEN = 0x17; // bytes zeroed at the struck target

/** Absolute value of an 8-bit subtraction result given whether the subtract borrowed. */
function absDiff(raw, borrow) {
  return borrow ? (-raw) & 0xff : raw;
}

export function loc_5ebd(m, hl = m.regs.hl, ix = m.regs.ix, iy = m.regs.iy, count = m.regs.b) {
  const { mem8, mem16 } = m;

  if (mem8[hl] === 0) return loc_5f06(m, hl, ix, count, iy); // empty slot
  if (mem8[u16(hl + 2)] >= STATE_LIMIT) return loc_5f06(m, hl, ix, count, iy); // busy slot

  const [e, y, onScreen] = precheckCollisionBounds(m, ix);
  if (!onScreen) return loc_5f06(m, hl, ix, count, iy); // off-screen

  const dx = absDiff((mem8[iy] - e) & 0xff, mem8[iy] < e);
  if (dx >= DX_LIMIT) return loc_5f06(m, hl, ix, count, iy); // horizontal gap too wide

  const yTarget = (mem8[iy + 2] + Y_MARGIN) & 0xff;
  const dy = absDiff((yTarget - y) & 0xff, yTarget < y);
  if (dy >= DY_LIMIT) return loc_5f06(m, hl, ix, count, iy); // vertical gap too wide

  // Hit: catch the slot.
  mem8[hl] = 0x00;
  mem8[u16(hl + 1)] = 0x01;
  mem8[u16(hl + 2)] = 0x08;

  const target = mem16[STRUCK_TARGET_LATCH];
  if ((mem8[u16(target + TARGET_FLAG_OFFSET)] & 0x01) === 0) {
    loc_0010(m, target, 0x00, TARGET_FILL_LEN); // zero-fill the struck target record
  }
  return loc_5f02(m); // hit-sound enqueue
}
