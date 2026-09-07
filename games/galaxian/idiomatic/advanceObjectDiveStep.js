// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectDiveStep -- object-AI state 4: the diving attacker's per-frame descent step.
 *
 * WHAT IT IS
 *   Slot 4 of the sixteen-entry object-AI state table (the RST-28 driveObjectSlot dispatch table at ROM
 *   0x0ce6, entered at ROM 0x0e6b). It runs an attacker that has peeled off the formation and is swooping
 *   down the screen. Each frame it steps the object's position field down by one or two pixels depending
 *   on the frame-parity bit, then decides whether the dive continues or the state should advance.
 *
 * ROLE IN THE MACHINE
 *   The step size alternates 1/2 per frame off FRAME_COUNTER (ROM 0x425f, the free-running per-frame
 *   counter) so the average descent lands between one and two pixels. If the stepped position falls inside
 *   the narrow [6,9) window the object has reached its checkpoint: bump the state index (ix+2) and stop.
 *   Otherwise it runs advanceObjectFlightCurve (ROM 0x116b), the cross-coupled rotation whose heading
 *   high byte (ix+0x19) is the swoop offset, and folds that heading plus the per-object Y increment (ix+9)
 *   into a fresh screen Y (ix+4). A carry across the signed boundary means the swoop ran off the bottom of
 *   the screen, so the state is bumped instead of storing the Y -- ending the dive.
 *
 * ROM 0x0e6b.  Grounding: [seen] (write-tap confirmed through the object-AI dispatch chain).
 *
 * LIVE-OUT: object record cells -- position ix+3, screen Y ix+4, state index ix+2 -- plus the flight-curve
 * accumulators updated inside advanceObjectFlightCurve.
 */
import { advanceObjectFlightCurve } from "./advanceObjectFlightCurve.js";
import { FRAME_COUNTER } from "./names.js";

const OBJ_STATE = 0x02;   // state index (bumped when the object is inside the window)
const OBJ_POS = 0x03;     // stepped position
const OBJ_Y = 0x04;       // computed Y output
const OBJ_INC = 0x09;     // per-object Y increment
const OBJ_HEADING = 0x19; // flight-curve heading hi-byte

export function advanceObjectDiveStep(m, obj = m.regs.ix) {
  const { mem8 } = m;
  // Local helper: advance this object's dispatch state index (ix+2) by one.
  const bumpState = () => { mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 1; };

  // Step the position (ix+3) by 1 or 2 depending on FRAME_COUNTER's low bit, so the pace alternates.
  const step = (mem8[FRAME_COUNTER] & 0x01) + 1;
  const pos = (mem8[obj + OBJ_POS] + step) & 0xff;
  mem8[obj + OBJ_POS] = pos;

  // Position inside the [6, 9) checkpoint window: the dive leg is done -> bump the state index and stop.
  if (((pos - 6) & 0xff) < 3) return bumpState();

  // Outside the window: run the flight-curve integrator, then fold its heading + increment into a new Y.
  advanceObjectFlightCurve(m, obj);

  // Combine the curve heading hi-byte (ix+0x19) with the per-object Y increment (ix+9).
  const heading = mem8[obj + OBJ_HEADING];
  const sum = heading + mem8[obj + OBJ_INC];
  const carry = sum > 0xff;
  const negative = (heading & 0x80) !== 0;

  // The sign of the heading selects which carry means "ran off the bottom": on that overflow, bump the
  // state (the swoop is finished); otherwise store the new screen Y (ix+4) and keep diving.
  if (negative ? carry : !carry) mem8[obj + OBJ_Y] = sum;
  else bumpState();
}
