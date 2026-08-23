// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0ee3 } from "./loc_0ee3.js";
import {
  DIFFICULTY_DSW,
  SPEED_INDEX,
  ROUND_COUNTER,
  SPEED_TABLE_38A5,
  SPEED_TABLE_38AD,
  ANIM_PTR_TABLE_38B5,
  ANIM_SEQ_3952,
} from "./names.js";
/**
 * loc_379d — initialise a new actor slot (at IY) from a template record (at IX).
 *
 * Seeds the slot's fixed fields (+0=1, +2=4, +14=C, +7=+0e=0), copies the template's four position
 * bytes with fixed biases (+5/+3 add 0x80, +4 subtract 1, +6 add 1), looks the speed magnitude out
 * of the difficulty-selected speed table via the round-clamped SPEED_INDEX and negates it on an odd
 * ROUND_COUNTER, mirrors that into the slot (+0a) and template (+0a), fetches the anim vector from
 * the pointer table by the template's frame nibble (overridden by a fixed sequence when +0b is set),
 * writes it plus the +0b flag and the +11 timer, then tail-hands to the spawn-sound enqueue.
 *
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back. The
 * tail call return-assigns A as a harmless value result; C is an input.
 */

const POS_BIAS = 0x80; //     added to the copied X/Y bytes
const SPEED_CLAMP = 0x08; //  speed index clamps below this
const SPEED_MAX = 0x07; //    ...to this
const HARD_DSW = 0x07; //     difficulty value selecting the alternate speed table
const SPAWN_TIMER = 0x28; //  slot +0x11

export function loc_379d(m, slot = m.regs.iy, template = m.regs.ix, c = m.regs.c) {
  const { mem8 } = m;

  mem8[slot + 0x00] = 0x01;
  mem8[slot + 0x02] = 0x04;
  mem8[slot + 0x14] = c;
  mem8[slot + 0x07] = 0x00;
  mem8[slot + 0x0e] = 0x00;

  mem8[slot + 0x05] = (mem8[template + 0x05] + POS_BIAS);
  mem8[slot + 0x03] = (mem8[template + 0x03] + POS_BIAS);
  mem8[slot + 0x04] = (mem8[template + 0x04] - 0x01);
  mem8[slot + 0x06] = (mem8[template + 0x06] + 0x01);

  const speedTable = mem8[DIFFICULTY_DSW] === HARD_DSW ? SPEED_TABLE_38AD : SPEED_TABLE_38A5;
  let speedIndex = mem8[SPEED_INDEX];
  if (speedIndex >= SPEED_CLAMP) speedIndex = SPEED_MAX;
  const [speed] = loc_0020(m, speedTable, speedIndex);

  let velocity = speed;
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) velocity = (-velocity) & 0xff; // mirrored facing
  mem8[slot + 0x0a] = velocity;
  mem8[template + 0x0a] = velocity;

  const frame = mem8[template + 0x07] >> 4;
  const looked = loc_0c45(m, frame, ANIM_PTR_TABLE_38B5);
  const flag = mem8[template + 0x0b];
  const animVector = flag === 0 ? looked : ANIM_SEQ_3952;
  mem8[slot + 0x0b] = flag;
  mem8[slot + 0x0c] = animVector; //                little-endian vector, low byte
  mem8[slot + 0x0d] = (animVector >> 8); //         ...high byte
  mem8[slot + 0x11] = SPAWN_TIMER;

  return loc_0ee3(m); // tail: conditionally enqueue the spawn sound; A is its result
}
