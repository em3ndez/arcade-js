// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommands95And10 } from "./queueSoundCommands95And10.js";
/**
 * descendLeadActorToLanding — the state-3 handler for a lead-actor record in the 0x8a80 arena.
 *
 * WHAT IT IS
 * A single frame's worth of work for one actor's own state machine. Every live actor in the arena
 * carries a small fixed-layout record; the byte at record+0x02 is that actor's state index, and once
 * per frame a dispatcher masks it and jumps to the handler for whichever state the actor is in. This
 * routine is the handler for state 3: an actor that is falling straight down toward its landing spot.
 * While the actor is in that state this runs every frame — it eases the actor a little further down
 * the screen and, the instant it touches the floor, plays a landing sound and hands the record on to
 * its next state so the machine stops making it fall.
 *
 * ROLE IN THE MACHINE
 * The actor world lives in ACTOR_TABLE (0x8a80) [seen], the arena of lead-actor records. Slot 0 is
 * the player/lead actor; the other slots are its derived sprite-row records. Each record is a bundle
 * of one-byte fields that mean the same thing wherever they are visited, and this state-3 handler
 * touches five of them:
 *   - record+0x02  state index — the actor's position in its own state machine; the dispatcher masks
 *                  this and uses it to pick a handler. Bumping it here is how the actor leaves the
 *                  falling state and moves on.
 *   - record+0x04  Y coordinate — the actor's vertical position on screen. Larger values are lower,
 *                  so making an actor descend means growing this field.
 *   - record+0x05  a free-running per-frame sub-counter whose low bit therefore flips every frame; it
 *                  is used here purely as an every-other-frame gate.
 *   - record+0x06  a countdown the actor carries, ticked down at half the frame rate (only on the
 *                  frames the +0x05 gate lets through).
 *   - record+0x11  frame delay — a small pacing reload the lead-actor handlers stash so the state the
 *                  actor moves into starts with a fresh delay budget.
 *
 * ROM 0x24b9-0x24da. [seen].
 *
 * LIVE-OUT: memory only — the record fields at record+0x02, +0x04, +0x05, +0x06 and +0x11. The
 * dispatcher that selected this handler reads no register or flag back from it, so the compare result
 * left behind on the early-return path is never observed and does not matter.
 */
const FLOOR_Y = 0xdc; // the Y coordinate that counts as the floor: once the descending actor's Y
                      // reaches (or passes) this the fall is over and the state transition fires.
const FRAME_DELAY_RESEED = 0x02; // the value stamped into the frame delay at record+0x11 on landing,
                                 // priming the next state with a two-frame pacing budget.

export function descendLeadActorToLanding(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Alternate-frame gate. record+0x05 is bumped once every frame, so its bit 0 toggles frame by
  // frame. The +0x06 countdown below is only allowed to tick on the frames where that bit lands
  // clear (the even values), which halves its rate relative to the frame counter.
  mem8[rec + 0x05] = mem8[rec + 0x05] + 1;
  if ((mem8[rec + 0x05] & 0x01) === 0) {
    mem8[rec + 0x06] = mem8[rec + 0x06] - 1; // decrement only on the even (bit0-clear) frames
  }

  // Descend. The actor's Y at record+0x04 grows by two each frame — a steady downward drift, since
  // larger Y is lower on the screen. If the new Y is still short of the floor there is nothing more
  // to do this frame: the actor is mid-fall, so leave it in state 3 and return.
  mem8[rec + 0x04] = mem8[rec + 0x04] + 0x02;
  if (mem8[rec + 0x04] < FLOOR_Y) return; // Y still above the floor: nothing more to do

  // Landing. Y has reached the floor. Announce the touchdown with the landing sound burst — a call
  // into queueSoundCommands95And10 drops the {0x95, 0x10} command pair into the sound ring, which the
  // once-per-frame audio drain later pays out (silently gated to play only while a game is live).
  queueSoundCommands95And10(m); // reached the floor: queue the pattern-A sound
  // Reseed the frame delay at record+0x11 so the state the actor is about to enter opens with a fresh
  // pacing budget rather than whatever counted down during the fall.
  mem8[rec + 0x11] = FRAME_DELAY_RESEED;
  // Advance the actor out of the falling state: bumping the state index at record+0x02 means next
  // frame the dispatcher routes this record to the following handler instead of back here.
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
}
