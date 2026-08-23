// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { loc_6080 } from "./loc_6080.js";
import { loc_6287 } from "./loc_6287.js";
import { loc_630f } from "./loc_630f.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_0010 } from "./loc_0010.js";
import { loc_0ef1 } from "./loc_0ef1.js";
import {
  FLIP_SCREEN_FLAG,
  ROUND_COUNTER,
  ENEMY_ACTOR_TABLE,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  POSITION_DELTA_TABLE_6358,
  ANIM_SCRIPT_6343,
} from "./names.js";
/**
 * loc_61b4 — collision handler for the current record.
 *
 * Finds the target slot whose tag matches the record; a busy slot or no match falls back to the
 * proximity gate. A matched slot dispatches on the high nibble of its state byte: some kinds
 * defer to the proximity gate or a sibling test, one kind (and the default) runs the award path.
 * The award path latches the actor onto the record, adds the round-indexed delta to both the
 * record and the re-found slot, arms the slot, wipes the parity target buffer, plays the sound,
 * then unwinds the caller's frame.
 *
 * LIVE-OUT: a boolean — true = normal completion, false = a caller-skip must unwind the frame.
 */
const TAG_OFFSET = 0x14;
const SLOT_STRIDE = 0x18;
const FIRST_SCAN_SLOTS = 0x05;
const BUSY_FIELD = 0x0b;
const STATE_FIELD = 0x16;
const DELTA_FIELD = 0x0a;
const REARM_BIT = 0x10;
const X_GAP_LIMIT = 0x09;
const Y_GAP_LIMIT = 0x08;
const REFIND_SLOTS = 0x06;
const TARGET_WIPE_LEN = 0x18;

export function loc_61b4(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  const key = mem8[(hl & ~0xff) | ((hl + TAG_OFFSET) & 0xff)];

  // find a matching, non-busy target slot
  let slot = ENEMY_ACTOR_TABLE;
  let stateByte = -1;
  for (let n = 0; n < FIRST_SCAN_SLOTS; n++, slot = u16(slot + SLOT_STRIDE)) {
    if (key !== mem8[u16(slot + TAG_OFFSET)]) continue;
    if (mem8[u16(slot + BUSY_FIELD)] !== 0) break; // busy -> proximity gate
    stateByte = mem8[u16(slot + STATE_FIELD)];
    break;
  }
  if (stateByte < 0) return loc_6080(m, hl, ix, count); // no usable match

  const nibble = stateByte & 0xf0;
  if (nibble === 0x00) return loc_6080(m, hl, ix, count);
  if (nibble === 0x50 || nibble === 0xd0) return loc_6287(m, nibble, hl, ix, count);
  if (nibble === 0xf0) return loc_630f(m, hl, ix, count);

  // proximity gate before the award path
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  if (Math.abs(mem8[iy] - ax) >= X_GAP_LIMIT) return loc_60f2(m, hl, ix, count);
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= Y_GAP_LIMIT) return loc_60f2(m, hl, ix, count);

  // award path
  setActorAnimation(m, hl, ANIM_SCRIPT_6343);
  const index = (mem8[ROUND_COUNTER] & 0x07) >> 1;
  const [d1] = loc_0020(m, POSITION_DELTA_TABLE_6358, index);
  mem8[u16(hl + DELTA_FIELD)] = mem8[u16(hl + DELTA_FIELD)] + d1;

  const tag = mem8[u16(hl + TAG_OFFSET)];
  let found = ENEMY_ACTOR_TABLE;
  for (let remaining = REFIND_SLOTS; ; ) {
    if (tag === mem8[u16(found + TAG_OFFSET)]) break;
    found = u16(found + SLOT_STRIDE);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) break;
  }
  const [d2] = loc_0020(m, POSITION_DELTA_TABLE_6358, index);
  mem8[u16(found + DELTA_FIELD)] = mem8[u16(found + DELTA_FIELD)] + d2;
  mem8[u16(found + STATE_FIELD)] = mem8[u16(found + STATE_FIELD)] | REARM_BIT;

  loc_0010(m, ireg !== 0 ? ENEMY_TARGET_REC1 : ENEMY_TARGET_REC0, 0x00, TARGET_WIPE_LEN);
  loc_0ef1(m);
  return false; // caller-skip: unwind the caller's frame
}
