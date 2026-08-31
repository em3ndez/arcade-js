// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ANIM_SEQ_3D0F, ANIM_TABLE_3838 } from "./names.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceActorAnimFrame } from "./advanceActorAnimFrame.js";
/**
 * seedFormationChildIntoFreeSlotAndLaunchParent — per-record body of the enemy-formation child-spawn scan.
 *
 * WHAT IT IS
 *   ROM 0x3cae-0x3d0e. This is the inner body the formation manager
 *   (spawnFormationChildIntoFreeSlotOnTimer) runs once per formation record while it hunts for a
 *   free slot: `child` is one record in the 4-slot formation table (FORMATION_TABLE, 0x8c30,
 *   stride 0x18) and `parent` is the launching actor. All records share the game's common actor
 *   layout, whose relevant fields are:
 *     +0x00/+0x01  presence bytes  (both zero => the slot is free)
 *     +0x02        state byte
 *     +0x03/+0x04  vertical position pair  (+0x03 sub-pixel, +0x04 coarse; +0x04 is the record's Y)
 *     +0x05/+0x06  horizontal position pair (+0x05 sub-pixel, +0x06 coarse)
 *     +0x08        motion-enable flag  (nonzero => the velocity mover drives this record)
 *     +0x0a        vertical velocity byte
 *     +0x0c/+0x0d  animation-sequence pointer (little-endian)
 *     +0x0e        animation frame/step index
 *     +0x14/+0x15  child-record back-pointer (little-endian), written into the parent
 *
 * ROLE IN THE MACHINE
 *   When an enemy is due to release a child (a bird dropped from a hunter/parent), the manager
 *   scans the formation slots and hands each to this body. If the slot is already taken the machine
 *   moves on to the next record; the first free slot is seated with a freshly launched child and the
 *   scan then stops — exactly one child is released per launch. Seating a child also flips the
 *   PARENT into its launch state and starts both actors moving with the same downward velocity, and
 *   links the parent to the child it just spawned.
 *
 * GROUNDING
 *   [seen] — the formation-spawn path this drives is confirmed: FORMATION_TABLE (0x8c30), the
 *   child animation sequence ANIM_SEQ_3D0F (data at 0x3d0f, just past this routine) and the parent
 *   launch animation table ANIM_TABLE_3838 all carry [seen] tags in the name registry, as does the
 *   caller spawnFormationChildIntoFreeSlotOnTimer.
 *
 * LIVE-OUT: boolean only — true tells the scan to keep going to the next record (this slot is
 *   occupied), false tells it to stop (a child has just been seated here). No register the caller
 *   reads is modified; every other effect is the memory writes below.
 */

const ACTIVE = 0x01; // slot / record active marker
const PARENT_LAUNCH_STATE = 0x06; // parent state byte on launch
const LAUNCH_VELOCITY = 0xe8; // parent + child vertical velocity

export function seedFormationChildIntoFreeSlotAndLaunchParent(m, child = m.regs.iy, parent = m.regs.ix) {
  const { mem8 } = m;

  // --- Slot guard --------------------------------------------------------------------------------
  // A record is free only when both presence bytes are zero. If either is set the slot already
  // holds a live actor, so nothing is seated and the scan is told to advance to the next record.
  if ((mem8[child + 0x00] | mem8[child + 0x01]) !== 0) return true; // slot occupied -> keep scanning

  // --- Seat the child into the free slot ---------------------------------------------------------
  // Claim the slot (presence byte 1 = active), give it its initial spawned state 0x10, point its
  // animation at the child sequence at 0x3d0f, and reset its animation frame to the first step.
  mem8[child + 0x01] = ACTIVE;
  mem8[child + 0x02] = 0x10;
  mem8[child + 0x0c] = ANIM_SEQ_3D0F;
  mem8[child + 0x0d] = ANIM_SEQ_3D0F >> 8;
  mem8[child + 0x0e] = 0x00;

  // --- Flip the parent into its launch state -----------------------------------------------------
  // The releasing actor changes state (0x06), enables its motion flag, takes the launch velocity,
  // and has its animation restarted on the launch table 0x3838 so it plays the drop/launch frames.
  mem8[parent + 0x02] = PARENT_LAUNCH_STATE;
  mem8[parent + 0x08] = ACTIVE;
  mem8[parent + 0x0a] = LAUNCH_VELOCITY;
  setActorAnimation(m, parent, ANIM_TABLE_3838); // parent's launch animation

  // --- Place the child next to the parent --------------------------------------------------------
  // The child inherits the parent's position, offset by one coarse unit on each axis so it appears
  // adjacent rather than exactly on top: vertical coarse -1, horizontal coarse +1, both sub-pixel
  // bytes copied through unchanged.
  mem8[child + 0x04] = u8(mem8[parent + 0x04] - 1);
  mem8[child + 0x03] = mem8[parent + 0x03];
  mem8[child + 0x06] = u8(mem8[parent + 0x06] + 1);
  mem8[child + 0x05] = mem8[parent + 0x05];

  // --- Start the child moving --------------------------------------------------------------------
  // Give the child the same motion-enable flag and launch velocity as the parent, then step its
  // animation one frame so it renders in motion from the very first frame after spawning.
  mem8[child + 0x08] = ACTIVE;
  mem8[child + 0x0a] = LAUNCH_VELOCITY;
  advanceActorAnimFrame(m, child); // step the freshly-seated child's animation

  // --- Link parent -> child, then stop the scan --------------------------------------------------
  // Record the child's address in the parent's back-pointer (+0x14/+0x15) so the parent can find
  // the actor it launched, and report false so the manager releases only this one child.
  mem8[parent + 0x14] = child; // link child pointer into the parent
  mem8[parent + 0x15] = child >> 8;
  return false; // launched -> caller aborts the scan
}
