// SPDX-License-Identifier: GPL-3.0-only
/** runOneShotAnimatedObjectSlot — run one slot's shape-cycle for a frame: rearm it once when its counter reads high (it does not self-retrigger), then
 * count the counter down and either retire the slot when it hits zero, or drift it with the world
 * and drive its sprite shape from a table keyed on the counter. LIVE-OUT: memory only. */

import { stampObjectStateByte3bThenRequestSound } from "./stampObjectStateByte3bThenRequestSound.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { fetchTableByte } from "./fetchTableByte.js";

const COUNTER = 0;
const REARM_AT = 0x3c;
const SHAPE_FLOOR = 0x1c;
const SHAPE_TABLE = 0x4094;
const SPRITE_SHAPE = 1;
const SPRITE_ATTR = 0x30;
const SPRITE_TAIL = 0x31;
const SHAPE_ATTR = 0x0e;

export function runOneShotAnimatedObjectSlot(m) {
  const { regs, mem8 } = m;
  const object = regs.ix;
  const sprite = regs.iy;

  if (mem8[object + COUNTER] >= REARM_AT) stampObjectStateByte3bThenRequestSound(m);

  mem8[object + COUNTER] = (mem8[object + COUNTER] - 1) & 0xff;
  if (mem8[object + COUNTER] === 0) {
    mem8[sprite] = 0;
    mem8[sprite + SPRITE_TAIL] = 0;
    return;
  }

  driftWithWorldScroll(m);

  const counter = mem8[object + COUNTER];
  if (counter < SHAPE_FLOOR) return;
  // counter above the floor, rotated right twice, low nibble: the shape-table index.
  regs.a = ((((counter - SHAPE_FLOOR) & 0xff) >> 2) | (((counter - SHAPE_FLOOR) & 0xff) << 6)) & 0x0f;
  regs.hl = SHAPE_TABLE;
  fetchTableByte(m);
  mem8[sprite + SPRITE_SHAPE] = regs.a;
  mem8[sprite + SPRITE_ATTR] = SHAPE_ATTR;
}
