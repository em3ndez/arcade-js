// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ANIM_SEQ_3D0F, ANIM_TABLE_3838 } from "./names.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceActorAnimFrame } from "./advanceActorAnimFrame.js";
/**
 * loc_3cae — per-record spawn helper: seat a child into a formation slot, or skip it.
 *
 * Called per formation record (child) with the parent actor. If the slot is already active —
 * its first two bytes are not both zero — the caller keeps scanning, signalled by returning
 * true. Otherwise it seats a spawned child into the free slot: marks it active, points its
 * animation at the child sequence, copies the parent's coordinate fields into the child (one
 * decremented, another incremented), flips the parent into launch state with a downward
 * velocity and queues the parent's launch animation, advances the child's animation one frame,
 * links the child pointer back into the parent, and returns false so the caller aborts the
 * remaining scan after this single launch.
 *
 * LIVE-OUT: boolean only — true keeps the caller's scan going, false aborts it; no register the
 * caller reads is modified. All other effects are in memory.
 */

const ACTIVE = 0x01; // slot / record active marker
const PARENT_LAUNCH_STATE = 0x06; // parent state byte on launch
const LAUNCH_VELOCITY = 0xe8; // parent + child vertical velocity

export function loc_3cae(m, child = m.regs.iy, parent = m.regs.ix) {
  const { mem8 } = m;

  if ((mem8[child + 0x00] | mem8[child + 0x01]) !== 0) return true; // slot occupied -> keep scanning

  mem8[child + 0x01] = ACTIVE;
  mem8[child + 0x02] = 0x10;
  mem8[child + 0x0c] = ANIM_SEQ_3D0F;
  mem8[child + 0x0d] = ANIM_SEQ_3D0F >> 8;
  mem8[child + 0x0e] = 0x00;
  mem8[parent + 0x02] = PARENT_LAUNCH_STATE;
  mem8[parent + 0x08] = ACTIVE;
  mem8[parent + 0x0a] = LAUNCH_VELOCITY;
  setActorAnimation(m, parent, ANIM_TABLE_3838); // parent's launch animation
  mem8[child + 0x04] = u8(mem8[parent + 0x04] - 1);
  mem8[child + 0x03] = mem8[parent + 0x03];
  mem8[child + 0x06] = u8(mem8[parent + 0x06] + 1);
  mem8[child + 0x05] = mem8[parent + 0x05];
  mem8[child + 0x08] = ACTIVE;
  mem8[child + 0x0a] = LAUNCH_VELOCITY;
  advanceActorAnimFrame(m, child); // step the freshly-seated child's animation
  mem8[parent + 0x14] = child; // link child pointer into the parent
  mem8[parent + 0x15] = child >> 8;
  return false; // launched -> caller aborts the scan
}
