// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceFallStep } from "./advanceFallStep.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * advanceObjectFallStepThenBlankBandOnLand
 * ----------------------------------------
 * WHAT IT IS: one state of a per-object state machine — the handler that makes an object (a
 * struck / dropped actor) hang motionless for a beat and then drop straight down until it
 * reaches its landing row, whereupon its sprite is erased. It occupies one slot of the
 * seventeen-entry state jump table the per-record dispatcher routes through on the object's
 * state byte.
 *
 * ROLE IN THE MACHINE: each frame the arena sweep hands every live object record (0x18-byte
 * stride, addressed through IX) to the dispatcher, which reads the record's state byte and runs
 * the matching handler. While an object is parked in this state the handler, per frame:
 *   1. burns down a dwell timer so the object hangs in place for a fixed number of frames;
 *   2. once the dwell has fully elapsed, steps the object's animation and integrates one
 *      gravity step of downward motion;
 *   3. when the fall reaches the landing row, blanks the object's sprite band to retire it
 *      from the screen.
 *
 * ROM: 0x4364-0x4375.
 * Grounding: [seen].
 *
 * LIVE-OUT: nothing the dispatcher reads back — this is a leaf of the per-record state sweep
 * and all of its effects land in the record and in video memory. On the landing branch the
 * sprite-band blanker leaves HL advanced past the erased band and B = 0; on the dwell and the
 * still-falling branches only record memory changes.
 */

// Record offset +0x11: the object's dwell / frame-delay down-counter. The lead-actor handlers
// pace their transitions off this byte; here it is the idle countdown that runs before the fall.
const PHASE_TIMER = 0x11;

export function advanceObjectFallStepThenBlankBandOnLand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Dwell gate (ROM 0x4364-0x436d). The object first idles for a set number of frames: read the
  // phase-timer byte at record offset +0x11 and, while it is still non-zero, decrement it by one
  // and return, doing nothing else this frame. Crucially the gate wraps the whole step — nothing,
  // not even the animation, advances until the dwell has fully expired, which is what pins the
  // object motionless before it begins to fall.
  if (mem8[rec + PHASE_TIMER] !== 0) {
    mem8[rec + PHASE_TIMER] = mem8[rec + PHASE_TIMER] - 1;
    return;
  }

  // Dwell elapsed (ROM 0x436e -> 0x4006). Step the object's animation sequence one tick: the
  // frame-hold countdown holds the current frame on screen and, when it reaches zero, the script
  // walk pulls the next tile + colour attribute + hold — so the object keeps cycling its frames as
  // it drops.
  advanceObjectAnimationFrame(m, rec);
  // Gravity step (ROM 0x4371 -> 0x3fd5). Integrate one downward step of the fall. While the object
  // is still above its landing row (still falling) advanceFallStep signals so; the object then
  // stays parked in this state and the handler returns to await the next frame.
  if (advanceFallStep(m, rec)) return;
  // Landing (ROM 0x4375 -> 0x3553). The fall has reached the landing row, so retire the object:
  // blank its sprite band by zero-filling the 0x17-byte band from the record, erasing it from the
  // display. This is the terminal action of the state.
  return blankActorSpriteBand(m, rec);
}
