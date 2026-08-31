// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { queueSoundCommand04IfNotBusy } from "./queueSoundCommand04IfNotBusy.js";
import { SPEED_INDEX, ROUND_COUNTER, ENEMY_SPEED_TABLE, ANIM_SEQ_38CB } from "./names.js";
/**
 * initChildActorRecordFromParent  (ROM 0x142c-0x148b)  [seen]
 *
 * WHAT IT IS
 *   The spawn constructor for a paired actor. Every actor lives in a fixed 0x18-byte record, and the
 *   same offsets mean the same thing in every record: +0x00 is the liveness header (byte 0 = 1 marks
 *   the slot live), +0x02 is the state-machine index, +0x03..+0x06 are the position bytes (+0x04 is
 *   the Y coordinate), +0x07 is the facing / animation-variant flag, +0x0a is the per-frame velocity
 *   step, +0x0c/+0x0d is the little-endian animation-script pointer, +0x0e is the frame-hold
 *   countdown, +0x11 is the frame-delay pacer, and +0x14 is the collision key a projectile hit is
 *   matched against.
 *
 * ROLE IN THE MACHINE
 *   When an enemy actor (the parent) needs a companion object beside it, this routine stamps a brand
 *   new child record: it marks the child live, gives it its entry state, plants it next to the parent
 *   with small fixed offsets, and gives both actors the same round-scaled marching velocity so they
 *   move together. It closes by asking the sound engine to play the spawn sound.
 *
 *   `parent` (IX) is the source record read for position; `child` (IY) is the destination record
 *   being built; `c` (C) is the collision key to stamp into the new child.
 *
 * LIVE-OUT
 *   Writes to the child record: +0x00, +0x02, +0x03, +0x04, +0x05, +0x06, +0x07, +0x0a, +0x0b,
 *   +0x0c, +0x0d, +0x0e, +0x11, +0x14. Also writes the shared velocity into the parent's +0x0a.
 *   Leaves in A the result of the spawn-sound enqueue it ends by jumping into (so A carries that
 *   downstream). C is only read (the collision key) and is otherwise untouched.
 */

const RECORD_FLAG = 0x01; //  child +0x00: liveness header byte -> record is live
const RECORD_KIND = 0x04; //  child +0x02: initial state-machine index (the child's entry state)
const POS_BIAS = 0x80; //     added to two of the copied position bytes
const SPEED_CLAMP = 0x08; //  speed index at/above this...
const SPEED_MAX = 0x07; //    ...is pinned to this (table has 8 entries, valid indices 0..7)
const SPAWN_TIMER = 0x28; //  child +0x11: frame-delay pacer seeded for the newly spawned actor

export function initChildActorRecordFromParent(m, parent = m.regs.ix, child = m.regs.iy, c = m.regs.c) {
  const { mem8 } = m;

  // Stamp the child's fixed slots. +0x00=1 marks the record live so the sweeps will visit it; +0x02=4
  // seats it at its entry state index; +0x14 receives the caller's collision key C. Then +0x07 (the
  // facing / animation-variant flag) and +0x0e (the frame-hold countdown) are cleared to a known
  // start so the new actor faces the default way and holds its first animation frame for zero frames.
  mem8[child + 0x00] = RECORD_FLAG;
  mem8[child + 0x02] = RECORD_KIND;
  mem8[child + 0x14] = c;
  mem8[child + 0x07] = 0x00;
  mem8[child + 0x0e] = 0x00;

  // Plant the child next to the parent by copying the parent's four position bytes with small fixed
  // offsets, so the companion appears just off the parent rather than exactly on top of it: +0x05 and
  // +0x03 gain 0x80, +0x04 (the Y coordinate) drops by one, and +0x06 rises by one. The byte wrap of
  // these adds/subtracts is the intended arithmetic.
  mem8[child + 0x05] = (mem8[parent + 0x05] + POS_BIAS);
  mem8[child + 0x03] = (mem8[parent + 0x03] + POS_BIAS);
  mem8[child + 0x04] = (mem8[parent + 0x04] - 0x01);
  mem8[child + 0x06] = (mem8[parent + 0x06] + 0x01);

  // Look up the enemy's marching-speed magnitude. SPEED_INDEX (0x8900) is the enemy speed/difficulty
  // index that escalates with the wave/round; the speed table has only 8 entries, so any index of 8
  // or more is pinned to 7 before use. The lookup indexes ENEMY_SPEED_TABLE (0x148e) by that clamped
  // value (base + index, then read the byte there) to get the raw speed.
  let speedIndex = mem8[SPEED_INDEX];
  if (speedIndex >= SPEED_CLAMP) speedIndex = SPEED_MAX;
  const [speed] = fetchByteFromTableIndex(m, ENEMY_SPEED_TABLE, speedIndex);

  // Turn the magnitude into a signed velocity for this round's facing. ROUND_COUNTER (0x8907) bit 0
  // selects the stage-type / facing variant: on odd rounds the actor marches the other way, so the
  // speed is two's-complement negated (kept to a byte). On even rounds it keeps its positive sign.
  let velocity = speed;
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) velocity = (-velocity) & 0xff; // mirrored facing on odd rounds

  // Publish that one velocity into three velocity fields so parent and child move in lockstep: the
  // child's +0x0a and +0x0b step fields, and the parent's own +0x0a. Both actors then advance at the
  // same round-scaled speed and direction each frame.
  mem8[child + 0x0a] = velocity;
  mem8[parent + 0x0a] = velocity;
  mem8[child + 0x0b] = velocity;

  // Arm the child's animation and pacing. The animation-script pointer +0x0c/+0x0d is seeded
  // little-endian with ANIM_SEQ_38CB (0x38cb), the ROM animation-sequence descriptor the child plays;
  // +0x11 gets the frame-delay pacer so the fresh actor times its transitions from a known start.
  mem8[child + 0x0c] = ANIM_SEQ_38CB; //        animation-script pointer, low byte
  mem8[child + 0x0d] = (ANIM_SEQ_38CB >> 8); // ...high byte
  mem8[child + 0x11] = SPAWN_TIMER;

  // Announce the spawn: the routine ends by jumping into the spawn-sound enqueue, which (when the
  // sound engine is not otherwise busy) appends command 0x04 to the sound-command ring. Because this
  // is the final jump, that call's A becomes this routine's A.
  return queueSoundCommand04IfNotBusy(m);
}
