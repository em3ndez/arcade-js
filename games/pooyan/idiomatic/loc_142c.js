// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { loc_0ee3 } from "./loc_0ee3.js";
import { SPEED_INDEX, ROUND_COUNTER, ENEMY_SPEED_TABLE, ANIM_SEQ_38CB } from "./names.js";
/**
 * loc_142c — spawn and initialise a child actor record (at IY) from its parent (at IX). Seeds
 * the child's fixed slots (+0=1, +2=4, +14=C, +7=+0e=0), copies the parent's four position bytes
 * with fixed biases (+5/+3 add 0x80, +4 subtract 1, +6 add 1), looks the enemy speed magnitude
 * out of the speed table via the round-clamped SPEED_INDEX, negates it on odd ROUND_COUNTER, and
 * mirrors that velocity into the child (+0a/+0b) and parent (+0a). Then it seeds the anim vector
 * into +0c/+0d, sets the spawn timer at +11, and tail-hands to the spawn-sound enqueue.
 * LIVE-OUT: A — the tail call produces the result A (return-assigned there), so it
 * survives as this routine's A for a register-dispatched caller. C is an input, unmodified.
 */

const RECORD_FLAG = 0x01; //  child +0x00: record-active
const RECORD_KIND = 0x04; //  child +0x02: actor kind
const POS_BIAS = 0x80; //     added to the copied X/Y bytes
const SPEED_CLAMP = 0x08; //  speed index clamps below this
const SPEED_MAX = 0x07; //    ...to this
const SPAWN_TIMER = 0x28; //  child +0x11

export function loc_142c(m, parent = m.regs.ix, child = m.regs.iy, c = m.regs.c) {
  const { mem8 } = m;

  mem8[child + 0x00] = RECORD_FLAG;
  mem8[child + 0x02] = RECORD_KIND;
  mem8[child + 0x14] = c;
  mem8[child + 0x07] = 0x00;
  mem8[child + 0x0e] = 0x00;

  mem8[child + 0x05] = (mem8[parent + 0x05] + POS_BIAS);
  mem8[child + 0x03] = (mem8[parent + 0x03] + POS_BIAS);
  mem8[child + 0x04] = (mem8[parent + 0x04] - 0x01);
  mem8[child + 0x06] = (mem8[parent + 0x06] + 0x01);

  let speedIndex = mem8[SPEED_INDEX];
  if (speedIndex >= SPEED_CLAMP) speedIndex = SPEED_MAX;
  const [speed] = loc_0020(m, ENEMY_SPEED_TABLE, speedIndex);

  let velocity = speed;
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) velocity = (-velocity) & 0xff; // mirrored facing

  mem8[child + 0x0a] = velocity;
  mem8[parent + 0x0a] = velocity;
  mem8[child + 0x0b] = velocity;

  mem8[child + 0x0c] = ANIM_SEQ_38CB; //        little-endian vector, low byte
  mem8[child + 0x0d] = (ANIM_SEQ_38CB >> 8); // ...high byte
  mem8[child + 0x11] = SPAWN_TIMER;

  return loc_0ee3(m); // tail: conditionally enqueue the spawn sound; A is its result
}
