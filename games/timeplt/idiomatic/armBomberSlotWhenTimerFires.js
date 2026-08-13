// SPDX-License-Identifier: GPL-3.0-only
/** armBomberSlotWhenTimerFires — on even frames only, tick a slot's arming countdown; when it reaches zero and the
 * mother ship is not already armed, arm the slot: pick a shape record from the heading, snap the
 * heading to a single facing bit, fetch the velocity pair for that facing, write shape, facing and
 * velocity into the slot record, set the shared hit count, and mark the slot live. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { loc_5942 } from "./loc_5942.js";
import { FRAME_TICK, HITS_REMAINING, MOTHER_SHIP_ARMED, PLAYER_HEADING, HEADING_SHAPE_TABLE } from "./names.js";

export function armBomberSlotWhenTimerFires(m) {
  const { regs, mem8 } = m;

  if (mem8[FRAME_TICK] & 0x01) return;

  const countdown = (regs.ix + 0x0e) & 0xffff;
  mem8[countdown] = u8(mem8[countdown] - 1);
  if (mem8[countdown] !== 0) return;
  if (mem8[MOTHER_SHIP_ARMED] !== 0) return;

  const heading = mem8[PLAYER_HEADING];
  // near a quadrant edge, nudge the heading a quarter-step toward the nearer axis
  let index = heading;
  if (((heading + 8) & 0x7f) < 0x10) {
    index = u8(heading + (mem8[FRAME_TICK] & 0x08 ? 0x10 : u8(-0x10)));
  }

  // shape record: rotate the heading to an even table offset, take its two bytes
  regs.hl = HEADING_SHAPE_TABLE;
  regs.a = ((index >> 2) | (index << 6)) & 0x3e;
  mem8[(regs.iy + 0x31) & 0xffff] = fetchTableByte(m);
  mem8[(regs.iy + 0x00) & 0xffff] = mem8[u16(regs.hl + 1)];

  const facing = u8(heading + 0xc0) & 0x80;
  mem8[(regs.ix + 0x02) & 0xffff] = facing;

  loc_5942(m);
  mem8[(regs.ix + 0x0a) & 0xffff] = regs.e;
  mem8[(regs.ix + 0x0b) & 0xffff] = regs.d;
  mem8[(regs.ix + 0x0c) & 0xffff] = regs.c;
  mem8[(regs.ix + 0x0d) & 0xffff] = regs.b;

  mem8[HITS_REMAINING] = 3;
  mem8[(regs.ix + 0x00) & 0xffff] = 0xff;
}
