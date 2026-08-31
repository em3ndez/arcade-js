// SPDX-License-Identifier: GPL-3.0-only
import { DROP_ANIM_DESCRIPTOR } from "./names.js";
import { setActorAnimation } from "./setActorAnimation.js";
/**
 * armActorDropAnimationNearTop — switch an enemy actor into its falling look once it has
 * climbed to the very top of its vertical travel. [seen] (ROM 0x3a51)
 *
 * WHAT IT IS
 * ----------
 * Every moving enemy on the field is tracked by an ACTOR RECORD, a fixed-layout block of
 * bytes in work RAM addressed here through `rec`. Among its fields the record carries a
 * 16-bit vertical position (a low byte and a high byte) that the enemy's motion handler nudges
 * along a velocity each frame, a one-byte SUB-STATE that says which phase of its life the enemy
 * is in, a one-byte phase timer that counts that phase down, and three bytes describing what it
 * is currently drawing (an animation-sequence pointer plus a frame index).
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is a small tail block of the enemy's vertical-motion state handler. That handler first
 * advances the enemy's vertical position along its velocity; the HIGH byte of the freshly
 * advanced position arrives here as `highPos`, and it is reached only on the branch where the
 * enemy's outer state byte is still zero — i.e. the enemy is on its ordinary climb. A small
 * high byte means the position has wound all the way up to the ceiling of its range, so this is
 * the moment the enemy has finished rising and should turn over and begin its descent. When it
 * is not yet at the top, this block does nothing and the enemy keeps climbing.
 *
 * When it IS at the top, three things flip together to commit the enemy to the drop: it is
 * retargeted onto the fall animation, its sub-state is stamped to the "dropping" value, and its
 * phase timer is reloaded so the new phase gets a full countdown.
 *
 * GROUNDING: [seen] — the record fields and the arm threshold are confirmed against the
 * running machine.
 *
 * LIVE-OUT: memory only — the actor record at `rec`. The animation fields (+0x0c..+0x0e, via
 * setActorAnimation), the sub-state byte (+0x02), and the phase timer (+0x11).
 */
const DROP_SUBSTATE = 0x02; // sub-state marking the actor as dropping
const DROP_TIMER = 0x28; // phase-timer reload for the drop

export function armActorDropAnimationNearTop(m, highPos = m.regs.b, rec = m.regs.ix) {
  const { mem8 } = m;
  // Gate on altitude: `highPos` is the high byte of the enemy's just-advanced vertical
  // position, and it shrinks toward zero as the enemy climbs. Only the top two rows of the
  // range (high byte 0 or 1) count as "at the top". Anywhere below that the enemy is still on
  // its way up, so leave the record untouched and let it keep rising.
  if (highPos >= 0x02) return;

  // At the top: retarget the actor onto the falling animation. This seats the drop
  // animation-sequence pointer (DROP_ANIM_DESCRIPTOR = ROM 0x3bd1) into the record's animation
  // fields and restarts it at frame 0, so the enemy visibly turns over from climbing to
  // dropping.
  setActorAnimation(m, rec, DROP_ANIM_DESCRIPTOR); // seat the drop animation into the record

  // Commit the phase change in the record itself. The sub-state byte (+0x02) is stamped to the
  // "dropping" value so the motion handler routes this enemy through its descent behaviour on
  // subsequent frames, and the phase timer (+0x11) is reloaded to 0x28 to give the drop phase a
  // fresh countdown.
  mem8[rec + 0x02] = DROP_SUBSTATE;
  mem8[rec + 0x11] = DROP_TIMER;
}
