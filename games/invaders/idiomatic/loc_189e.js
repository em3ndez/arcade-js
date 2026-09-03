// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { loc_0ab6 } from "./loc_0ab6.js";
import { TASK_FLAGS, ATTRACT_ANIM_ACK, loc_207e, loc_2050, loc_2080, loc_1bc0, loc_3311 } from "./names.js";

// Run one interrupt-handshaked attract animation: copy its descriptor, arm the animation task, then
// handshake on ATTRACT_ANIM_ACK bit0 (yield until the handler sets it, then yield until it clears),
// draw, and tail into a settle delay. Generator; memory + IO.
export function* loc_189e(m) {
  blockCopy(m, loc_1bc0, loc_2050, 0x10);
  m.mem8[loc_2080] = 0x02;
  m.mem8[loc_207e] = 0xff;
  m.mem8[TASK_FLAGS] = 0x04;
  while ((m.mem8[ATTRACT_ANIM_ACK] & 0x01) === 0) yield;
  while ((m.mem8[ATTRACT_ANIM_ACK] & 0x01) !== 0) yield;
  drawSprite8x8(m, 0x26, loc_3311);
  yield* loc_0ab6(m);
}
