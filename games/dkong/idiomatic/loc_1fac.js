// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fac — carry an OBJ_ARRAY_67 girder record one step along its travel, stamping it on arrival.
 * Each frame it advances OBJ_Y by one; on the frame OBJ_Y equals the record's target it also
 * restamps the sprite and flips the low three arm-select bits, handing the record to another arm.
 * Both exits converge on the sweep's shared sprite tail.
 *
 * WARNING: exx() is a contract across the sweep — the shared tail's own leading swap restores the
 * walk's cursors. Drop it here and the tail swaps the live set away instead of back. The record
 * pointer stays in ix, not a parameter: both tails read it off the machine, so a passed-in value
 * would be honoured here and ignored one call later.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_Y, OBJ_SPRITE_CODE } from "./names.js";

const TRAVEL_TARGET_Y = 0x17;
const ARRIVAL_CODE_SOURCE = 0x15;
const ARM_SELECT = 0x02;
const ARRIVAL_CODE_BASE = 21;

export function loc_1fac(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  regs.exx();

  const y = u8(mem8[record + OBJ_Y] + 1);
  mem8[record + OBJ_Y] = y;

  if (mem8[record + TRAVEL_TARGET_Y] !== y) return m.call(0x1fce);

  // Arrived: rotate the source byte left by two (the top bits wrap into the bottom) and stamp.
  const source = mem8[record + ARRIVAL_CODE_SOURCE];
  mem8[record + OBJ_SPRITE_CODE] = u8((source << 2) | (source >> 6)) + ARRIVAL_CODE_BASE;

  mem8[record + ARM_SELECT] = mem8[record + ARM_SELECT] ^ 0x07;

  return m.call(0x21ba);
}
