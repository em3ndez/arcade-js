// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2b, COORD_LIST_PTR_LO, ENEMY_PHASE } from "./names.js";

/**
 * scaleByPhaseFraction — scale a signed value by slot x's 3-bit phase fraction. ROM 0xb6fa.
 *
 * Role in the machine: an object's ENEMY_PHASE counter carries a fractional sub-position used to smooth its
 * motion along the tube. This routine multiplies an input value by the low three bits of that phase, read
 * as a fraction in eighths, so callers can interpolate a coordinate or delta by the object's current phase.
 *
 * Behavior: stash the input in loc_29 and the slot index in loc_2b, and pull slot x's phase fraction
 * (ENEMY_PHASE,x & 0x07) into the scratch cell COORD_LIST_PTR_LO. Then run three LSB-first rounds: each
 * round consumes the fraction's low bit, and if it is set adds the input into the accumulator; every round
 * ends with a sign-preserving (arithmetic) right shift of the accumulator. The result is a signed
 * shift-add product returned in A.
 *
 * Live-out: A = the scaled value; loc_29 holds the input, loc_2b the slot index, and COORD_LIST_PTR_LO the
 * shifted-out fraction residue. Grounding: [seen].
 */
export function scaleByPhaseFraction(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_29] = a;                       // stash the input value
  mem8[COORD_LIST_PTR_LO] = mem8[u16(ENEMY_PHASE + x)] & 0x07;  // 3-bit fraction from the phase counter
  mem8[loc_2b] = x;                        // stash x
  let acc = 0;
  for (let i = 0; i < 3; i++) {
    const bit = mem8[COORD_LIST_PTR_LO] & 1;               // consume the fraction LSB first
    mem8[COORD_LIST_PTR_LO] = mem8[COORD_LIST_PTR_LO] >> 1;
    if (bit) acc = (acc + a) & 0xff;
    acc = ((acc >> 1) | (acc & 0x80)) & 0xff;   // arithmetic (sign-preserving) >>1
  }
  return (m.regs.a = acc);
}
