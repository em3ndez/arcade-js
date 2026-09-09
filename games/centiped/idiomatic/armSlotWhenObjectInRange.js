// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { foldSignedMagnitude } from "./foldSignedMagnitude.js";
import { armSlotState } from "./armSlotState.js";
import { enterArmBlockUnlessValueHigh } from "./enterArmBlockUnlessValueHigh.js";
import { loc_54, loc_63, loc_64, loc_73, loc_8d } from "./names.js";

/**
 * armSlotWhenObjectInRange -- measure object X's distance from the reference point and arm its slot only
 * when it sits inside the range box. ROM 0x2b?? (range test + arm dispatch).
 *
 * Role in the machine: before an object slot is (re)armed for a spawn, the game checks that the object is
 * physically close to a reference point ($63 horizontal, $73 vertical) -- an "is it in the box?" proximity
 * test. Only objects inside a small rectangle around that reference are armed; anything outside is left
 * alone. This keeps arming local to where the action is rather than firing across the whole field.
 *
 * Detail: |dx| = |$54,X - $63| must clear its bound (0x0a for slot 0x0d, else 0x07) and |dy| =
 * |$64,X - $73| must clear 0x07, else it bails with no change. On success it stashes |dx| in $8d and
 * passes the summed distance to the slot arm: slot 0x0d takes the value-gated entry, every other slot
 * arms unless the sum is high (carry = sum >= 0x0c).
 *
 * Live-out: the carry flag (C=1 = "not armed / out of range", C=0 = "armed") plus, on the in-range path,
 * $8d = |dx| and whatever armSlotState writes. Grounding: [code].
 */
export function armSlotWhenObjectInRange(m, x = m.regs.x) {
  const { mem8 } = m;
  // Horizontal distance. Subtract the reference $63 from the object's X coordinate ($54+x), then take the
  // signed magnitude (|value|) via foldSignedMagnitude -- the sign bit picks whether to negate.
  const dxRaw = u8(mem8[(loc_54 + x) & 0xff] - mem8[loc_63]);
  const dxMag = foldSignedMagnitude(m, dxRaw, (dxRaw & 0x80) !== 0);
  // The horizontal window is wider (0x0a) for the special last slot 0x0d, narrower (0x07) for every other
  // slot. If the object is farther than the bound it is out of range: return carry SET, arming nothing.
  const dxBound = x === 0x0d ? 0x0a : 0x07;
  if (dxMag >= dxBound) return (m.regs.fC = true); // out of horizontal range -> C=1
  // In horizontal range: remember |dx| in $8d for the downstream arm to consume.
  mem8[loc_8d] = dxMag;
  // Vertical distance, same shape: |$64,X - $73| against a fixed 0x07 window. Out of range -> carry SET.
  const dyRaw = u8(mem8[(loc_64 + x) & 0xff] - mem8[loc_73]);
  const dyMag = foldSignedMagnitude(m, dyRaw, (dyRaw & 0x80) !== 0);
  if (dyMag >= 0x07) return (m.regs.fC = true); // out of vertical range -> C=1
  // Inside the box on both axes. Sum the two magnitudes into a single "closeness" scalar that the arm
  // block uses as its value gate.
  const sum = u8(dyMag + dxMag);
  // Dispatch to the arm block, re-exposing its exit carry as ours. The arm delegates do the writes and
  // return carry-CLEAR (false) when they arm; on their no-op (out-of-range) path they return undefined and
  // preserve the entry carry (SET). We normalise undefined back to true so our contract stays "C=1 = not
  // armed". Slot 0x0d takes the value-gated entry (arms only when sum < 0x0e); every other slot arms
  // unless the summed distance is high (carry = sum >= 0x0c).
  // Arm delegates do the writes and return carry-CLEAR (false) when they arm; on their no-op path they
  // return undefined and preserve the entry carry (SET). Re-expose that exit carry as our dispatch-out.
  if (x === 0x0d) {
    const armed = enterArmBlockUnlessValueHigh(m, sum, x);
    return (m.regs.fC = armed === undefined ? true : armed);
  }
  const armed = armSlotState(m, x, sum >= 0x0c);
  return (m.regs.fC = armed === undefined ? true : armed);
}
