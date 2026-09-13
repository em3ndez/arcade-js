// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2b, COORD_LIST_PTR_LO, ENEMY_PHASE } from "./names.js";

// Signed fractional scale: take slot x's low 3 phase bits as a fraction and
// accumulate a sign-preserving shift-add of the input over three rounds.
export function loc_b6fa(m, a = m.regs.a, x = m.regs.x) {
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
