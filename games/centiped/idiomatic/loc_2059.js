// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_00, loc_40, loc_43, loc_60, loc_70, loc_80, loc_88, loc_8b,
  loc_9a, loc_ab, loc_d7, loc_ef, loc_f0,
} from "./names.js";
import { stampGridCellAtObject } from "./stampGridCellAtObject.js";

// Gated per-object state step: bails unless $43 is clear and the object's folded X/Y offsets pass their
// bands (with a per-slot $9a/$ab/$d7 bounds test near the top edge); then cycles the $40 attribute every
// 4th frame, seeds $8b from $60, steps $70 by ±$80 (sign from $ef), and tail-dispatches the stamp gate.  [code]
export function loc_2059(m) {
  const { mem8 } = m;
  if ((mem8[loc_43] & 0xaf) !== 0) return;
  if (u8(mem8[loc_40] ^ mem8[loc_ef]) >= 32) return;
  const yFold = u8(mem8[loc_70] ^ mem8[loc_f0]);
  if (yFold >= 248) {
    // Near the top edge: run the per-slot distance bounds before advancing.
    const x = mem8[loc_88];
    if (mem8[u8(loc_9a + x)] >= 12) return;
    const sel = mem8[u8(loc_ab + x)];
    let bound = sel >= 2 ? 9 : 5;
    if (sel >= 18) bound = u8((sel >> 1) + 6);
    if (bound < mem8[u8(loc_d7 + x)]) return;
  }
  // Advance the $40 attribute once every 4th frame.
  if ((mem8[loc_00] & 0x03) === 0) {
    mem8[loc_40] = u8(mem8[loc_40] + 1);
    mem8[loc_40] = (((u8(mem8[loc_40] + 1) & 0x03) | 0x1c)) ^ mem8[loc_ef];
  }
  mem8[loc_8b] = mem8[loc_60];
  const stepped = mem8[loc_ef] === 0
    ? u8(mem8[loc_70] - mem8[loc_80])
    : u8(mem8[loc_70] + mem8[loc_80]);
  // Tail-dispatch the stamp gate with the stepped value.
  return stampGridCellAtObject(m, stepped);
}
