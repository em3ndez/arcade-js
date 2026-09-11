// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_37, loc_115, loc_3fe } from "./names.js";

// Remap an 8-entry table against a reference value: large entries shrink by a
// fixed offset, mid entries snap to a rail chosen by the reference's sign, and a
// zero entry adopts a rail based on its next neighbour. Each result is OR-folded;
// if every entry ends up zero the reference is itself cleared. No-op when the
// reference is already zero.
export function loc_a7d2(m) {
  const { mem8 } = m;
  const ref = mem8[loc_115];
  if (ref === 0) return;

  let acc = 0;
  for (let x = 7; x >= 0; x--) {
    const entry = mem8[u16(loc_3fe + x)];
    let result;
    if (entry === 0) {
      if (mem8[loc_115] & 0x80) {
        const next = x === 7 ? 0 : x + 1;
        const nbr = mem8[u16(loc_3fe + next)];
        result = nbr !== 0 && nbr < 0xd5 ? 0xf0 : 0;
      } else {
        result = 0;
      }
    } else if (entry >= 0x17) {
      result = entry - 7;
    } else {
      result = mem8[loc_115] & 0x80 ? 0xf0 : 0;
    }
    mem8[u16(loc_3fe + x)] = result;
    acc |= result;
  }

  mem8[loc_29] = acc;
  mem8[loc_37] = 0xff;
  if (acc === 0) mem8[loc_115] = 0;
}
