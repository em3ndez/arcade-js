// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSequenceDwellTimer (ROM 0x032e) -- one sequence-state handler in the attract/sequence machine.
 *
 * WHAT IT IS
 *   The attract show and every between-round pause walk themselves forward on a dwell-timer cascade.
 *   Three in-page bytes sit next to each other: loc_4008 (a fast sub-timer/prescaler), loc_4009 (the
 *   dwell tier), and SEQUENCE_STATE (0x400a) immediately above them. This handler is the plain,
 *   un-prescaled tier: it ticks loc_4009 directly, once per frame.
 *
 * ROLE IN THE MACHINE
 *   Dispatched as a SEQUENCE_STATE handler each frame. It points the shared tick at the dwell tier
 *   loc_4009 and hands off to tickCascadeCountdown (0x0331). That shared routine decrements the byte
 *   it is given and, when it expires, steps to the next in-page byte and increments it -- and because
 *   SEQUENCE_STATE (0x400a) sits directly above loc_4009, the carry-out of the dwell tier expiring is
 *   literally the sequence advancing to its next sub-state. So this handler is a pure hold that only
 *   moves the sequence forward when the dwell runs out.
 *
 * Grounding: [seen] (names.js cert for 0x032e; cascade described in mechanisms.md "The dwell-timer
 * cascade and how it advances the sequence").
 *
 * LIVE-OUT: loc_4009 (decremented, or reset on expiry) and, on expiry, SEQUENCE_STATE (0x400a) bumped.
 */
import { tickCascadeCountdown as loc_0331 } from "./tickCascadeCountdown.js";
import { loc_4009 } from "./names.js";

export function tickSequenceDwellTimer(m) {
  // Point the shared cascade tick at the mid dwell tier (loc_4009) and let it decrement-and-carry:
  // one tick down this frame, and on the frame it hits zero it carries up into SEQUENCE_STATE (0x400a),
  // which is what steps the attract/sequence machine to its next sub-state.
  loc_0331(m, loc_4009);
}
