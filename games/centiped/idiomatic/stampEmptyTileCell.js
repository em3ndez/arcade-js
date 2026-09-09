// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { TILEMAP_PTR_LO, loc_ef, loc_88, loc_d7 } from "./names.js";

/**
 * stampEmptyTileCell — stamp a value into the pointed grid cell, but only when it
 * is empty and its column belongs to a stampable class. A fold mask selects the
 * column thresholds and is XORed into the stamped byte, so one routine covers two
 * mirrored orientations; some columns bump a per-slot counter, others only stamp.
 */
export function stampEmptyTileCell(m) {
  const { mem8, mem16 } = m;
  const ptr = mem16[TILEMAP_PTR_LO]; // ($32) 16-bit tile-map cell pointer
  if (mem8[ptr] !== 0) return; // cell already occupied -> leave it untouched
  const col = mem8[TILEMAP_PTR_LO] & 0x1f; // low-5-bit column code (from the pointer low byte)
  if (col === 0 || col === 0x1f) return; // the two edge columns are never stamped
  const ef = mem8[loc_ef]; // fold mask: selects the thresholds AND is XORed into the stamp
  let bump;
  if (ef === 0) {
    if (col === 0x01) return; // column 1 excluded in this orientation
    bump = col < 0x0c; // <0x0c bumps the slot counter; >=0x0c writes only
  } else {
    if (col === 0x1e) return; // column 0x1e excluded in the mirrored orientation
    bump = col >= 0x14; // >=0x14 bumps; <0x14 writes only
  }
  if (bump) {
    const x = mem8[loc_88]; // current actor slot index
    const cnt = u8(loc_d7 + x); // $d7,X (zero-page indexed: wraps within page 0)
    mem8[cnt] = u8(mem8[cnt] + 1); // inc $d7,X
  }
  mem8[ptr] = 0x3f ^ ef; // stamp 0x3f^$ef through ($32)
}
