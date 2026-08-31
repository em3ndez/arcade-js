// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceObjectStateOnFrameTimerExpiry } from "./advanceObjectStateOnFrameTimerExpiry.js";
import { FALL_ANIM_TABLE } from "./names.js";
/**
 * startEnemyFall -- object state handler: begin the fall.  ROM 0x3f5c-0x3f71.
 * Grounding: [seen]
 *
 * WHAT IT IS
 *   One state in the per-object state machine that drives every enemy/target actor. When a struck
 *   or dislodged object first enters its "falling" state, this handler runs once to set the object
 *   plummeting: it installs the correct downward animation, seeds the fall speed, and steps the
 *   record on to the state that will tick that fall frame by frame.
 *
 *   Every object is a fixed-layout record; this handler works the one passed in `rec`. The fields
 *   it touches:
 *     rec+0x02  state byte    -- selects which state handler runs this object each frame
 *     rec+0x07  variant byte  -- low two bits distinguish the kinds of falling object
 *     rec+0x09  fall velocity -- the vertical step applied while the object descends
 *
 * ROLE IN THE MACHINE
 *   Reached when the object-state dispatch lands on this object's fall state. It is a one-shot setup
 *   step: after arming the fall it advances the state byte and then continues straight on into the
 *   next state handler (advanceObjectStateOnFrameTimerExpiry, ROM 0x3f72), the running state that
 *   animates the descent -- so the object both starts falling AND takes its first animated frame in
 *   the same visit.
 *
 * LIVE-OUT
 *   The record is left armed to fall: rec+0x0c/0x0d point at the chosen plummet animation (restarted
 *   at its first frame), rec+0x09 = 0x40 fall velocity, and rec+0x02 bumped on to the running fall
 *   state. Returns nothing the caller reads.
 */
// Record field offsets and the magic values written into a falling-object record (see header).
const VARIANT_MASK = 0x03;
const FALL_VELOCITY = 0x40;
const STATE_FIELD = 0x02;
const VARIANT_FIELD = 0x07;
const VELOCITY_FIELD = 0x09;

export function startEnemyFall(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Pick which plummet animation this object falls with. The low two bits of the record's variant
  // byte (rec+0x07) distinguish the kinds of falling object; biasing that down by one gives the
  // index into FALL_ANIM_TABLE (ROM 0x4072), the word table of plummet-animation pointers. The
  // result is kept to a byte so it indexes the table exactly as the hardware does.
  const variant = ((mem8[rec + VARIANT_FIELD] & VARIANT_MASK) - 1) & 0xff;
  // Read that variant's animation-sequence pointer out of the table: a little-endian word lookup
  // (fetchWordFromTableIndex, ROM 0x0c45) returning FALL_ANIM_TABLE[variant].
  const anim = fetchWordFromTableIndex(m, variant, FALL_ANIM_TABLE);
  // Point the record at that animation and restart it (setActorAnimation, ROM 0x381e): the pointer
  // is stored into the record's animation field (rec+0x0c/0x0d) and its frame cursor reset, so the
  // object begins its plummet animation from the very first frame.
  setActorAnimation(m, rec, anim);
  // Seed the fall speed: 0x40 into rec+0x09, the vertical step the descent handler applies each
  // frame to march the object down the screen.
  mem8[rec + VELOCITY_FIELD] = FALL_VELOCITY;
  // Advance the object's state-machine index (rec+0x02) off this one-shot setup state and on to the
  // running fall state, so later frames animate the descent instead of re-arming it.
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the state
  // Continue straight on into that next state handler (advanceObjectStateOnFrameTimerExpiry,
  // ROM 0x3f72): it ticks the animation and counts down the record's frame timer, so the object
  // takes its first animated fall frame during this same visit rather than waiting a frame.
  return advanceObjectStateOnFrameTimerExpiry(m, rec); // fall through into the next state handler
}
