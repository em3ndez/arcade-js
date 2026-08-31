// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { initChildActorRecordFromParent } from "./initChildActorRecordFromParent.js";
import { SPRITE_OBJECT_TABLE, ANIM_FRAME_COUNTER, ANIM_SEQ_3988 } from "./names.js";
/**
 * spawnChildActorIntoFreeSpriteSlot  (ROM 0x13bc-0x13fd)  [seen]
 *
 * WHAT IT IS
 *   The front half of a two-part spawn. When an enemy actor (the `parent`) needs a companion object
 *   placed beside it, the machine must first find somewhere to put that companion. This routine walks
 *   the five-slot sprite-object pool looking for a free record; if it finds one, it prepares the parent
 *   record and hands the parent, the free slot, and a fresh id to the constructor that actually builds
 *   the companion, initChildActorRecordFromParent.
 *
 *   Every actor lives in a fixed 0x18-byte record and the same offsets mean the same thing in every
 *   record: +0x00/+0x01 is the liveness header (bit 0 of either byte set marks the slot occupied),
 *   +0x02 is the state-machine index, +0x0c/+0x0d is the little-endian animation-script pointer,
 *   +0x0e is the frame-hold countdown, +0x11 is the frame-delay pacer, and +0x14 is the collision key
 *   a projectile hit is matched against.
 *
 * ROLE IN THE MACHINE
 *   Slot allocation plus parent set-up. The sprite-object pool SPRITE_OBJECT_TABLE (0x8b70) holds five
 *   records on a 0x18 stride; a record is free when the low bit of its header pair is clear. Once a
 *   free slot is located, the parent record is stamped with its entry state, its animation vector, a
 *   fresh frame-delay pacer, and a brand-new collision id drawn from the global animation-frame
 *   counter ANIM_FRAME_COUNTER (0x8d41). The routine then tail-jumps into the child constructor, which
 *   plants the companion in the located slot and gives both actors a matched marching velocity.
 *
 *   `parent` (IX) is the enemy record being fitted out and read for position downstream.
 *
 * LIVE-OUT
 *   On the spawn path: writes to the parent record at +0x14 (collision id), +0x0c/+0x0d (animation
 *   pointer), +0x0e (frame-hold), +0x11 (frame-delay pacer) and +0x02 (state), advances the shared
 *   counter ANIM_FRAME_COUNTER, and leaves A holding whatever the child constructor returns. On the
 *   no-free-slot path nothing is written; A is left holding the last scanned header pair's
 *   rotate-right byte, and the caller reads A back.
 */

const SLOT_COUNT = 5; //      SPRITE_OBJECT_TABLE (0x8b70) holds five records...
const SLOT_STRIDE = 0x18; //  ...one 0x18-byte record apart
const ANIM_TIMER = 0x28; //   parent +0x11: frame-delay pacer seeded for the fitted-out actor
const RECORD_KIND = 0x04; //  parent +0x02: state-machine index (the actor's entry state)

export function spawnChildActorIntoFreeSpriteSlot(m, parent = m.regs.ix) {
  const { mem8 } = m;

  // Scan the five-slot sprite-object pool SPRITE_OBJECT_TABLE (0x8b70) for the first free record.
  // Each record's occupancy lives in the low bit of its two-byte header (+0x00 | +0x01): if either
  // byte has bit 0 set the slot is in use, so OR the pair and test bit 0. The hardware performs that
  // test by rotating the OR'd byte right (bit 0 falls into carry); `lastPair` keeps that rotate-right
  // result because, if the whole pool turns out to be occupied, it is exactly what is left in A for
  // the caller. The first slot whose bit 0 is clear is the winner and the scan stops there.
  let slot = SPRITE_OBJECT_TABLE;
  let found = null;
  let lastPair = 0;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const bits = mem8[slot] | mem8[slot + 1];
    lastPair = ((bits >> 1) | ((bits & 0x01) << 7)) & 0xff; // rotate right: bit0 -> bit7
    if ((bits & 0x01) === 0) { found = slot; break; } //         bit0 clear -> free slot
    slot = u16(slot + SLOT_STRIDE);
  }
  // Pool full: no companion can be placed this pass. Nothing is stamped; the routine hands the caller
  // the residue left in A (the last header pair rotated right) and returns.
  if (found === null) return (m.regs.a = lastPair); // nothing free

  // Mint a fresh id for the pair by advancing the global animation-frame counter ANIM_FRAME_COUNTER
  // (0x8d41), which doubles as a rolling sprite id. It wraps in a byte, but zero is reserved (an id of
  // 0 reads as "no object"), so a wrap from 0xff lands on 0x01 rather than 0x00.
  let counter = (mem8[ANIM_FRAME_COUNTER] + 1) & 0xff;
  if (counter === 0) counter = 0x01; // the wrap skips zero
  mem8[ANIM_FRAME_COUNTER] = counter;

  // Fit out the parent record for the spawn. +0x14 takes the fresh counter as this actor's collision
  // key (the same id is stamped into the child by the constructor, so a projectile hit can match the
  // pair). +0x0c/+0x0d point the parent at the ROM animation-sequence descriptor ANIM_SEQ_3988
  // (0x3988), written little-endian. +0x0e clears the frame-hold countdown so the first animation
  // frame shows immediately, +0x11 seeds the frame-delay pacer, and +0x02 sets the entry state.
  mem8[parent + 0x14] = counter;
  mem8[parent + 0x0c] = ANIM_SEQ_3988;
  mem8[parent + 0x0d] = (ANIM_SEQ_3988 >> 8);
  mem8[parent + 0x0e] = 0x00;
  mem8[parent + 0x11] = ANIM_TIMER;
  mem8[parent + 0x02] = RECORD_KIND;

  // Hand the prepared parent, the free slot (the child destination) and the fresh id to the child
  // constructor, which builds the companion record next to the parent and gives both a matched
  // round-scaled velocity. This is the final jump, so the constructor's result becomes this routine's A.
  return initChildActorRecordFromParent(m, parent, found, counter);
}
