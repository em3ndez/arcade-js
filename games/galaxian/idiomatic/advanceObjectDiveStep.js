// SPDX-License-Identifier: GPL-3.0-only
// Object state-handler slot: step the object's position by 1 or 2 (alternating on the frame-parity bit),
// then window-check it. Inside the [6,9) window -> bump the state index. Outside, advance the flight curve and
// fold its heading hi-byte plus the per-object increment into a new Y; a carry that crosses the signed
// boundary bumps the state index instead of storing the Y.
import { advanceObjectFlightCurve } from "./advanceObjectFlightCurve.js";
import { loc_425f } from "./names.js";

const OBJ_STATE = 0x02;   // state index (bumped when the object is inside the window)
const OBJ_POS = 0x03;     // stepped position
const OBJ_Y = 0x04;       // computed Y output
const OBJ_INC = 0x09;     // per-object Y increment
const OBJ_HEADING = 0x19; // flight-curve heading hi-byte

export function advanceObjectDiveStep(m, obj = m.regs.ix) {
  const { mem8 } = m;
  const bumpState = () => { mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 1; };

  // Step the position by 1 or 2 depending on the frame-parity bit.
  const step = (mem8[loc_425f] & 0x01) + 1;
  const pos = (mem8[obj + OBJ_POS] + step) & 0xff;
  mem8[obj + OBJ_POS] = pos;

  // Inside the [6, 9) window -> bump the state index and stop.
  if (((pos - 6) & 0xff) < 3) return bumpState();

  // Outside: advance the flight curve, then fold heading + increment into a new Y.
  advanceObjectFlightCurve(m, obj);

  const heading = mem8[obj + OBJ_HEADING];
  const sum = heading + mem8[obj + OBJ_INC];
  const carry = sum > 0xff;
  const negative = (heading & 0x80) !== 0;

  // A carry that crosses the signed boundary means the swoop ran off the bottom: bump state; else store Y.
  if (negative ? carry : !carry) mem8[obj + OBJ_Y] = sum;
  else bumpState();
}
