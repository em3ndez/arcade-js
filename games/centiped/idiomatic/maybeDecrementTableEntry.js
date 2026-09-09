// SPDX-License-Identifier: GPL-3.0-only
import { TILEMAP_PTR_LO, loc_88, loc_d7, loc_ef } from "./names.js";

/**
 * maybeDecrementTableEntry — conditionally decrement one byte of a zero-page table.
 * Forms v = ($32 & 0x1f) and picks a band from $ef: when $ef == 0 decrement if v < 0x0c,
 * otherwise decrement if v >= 0x14. The index into the table comes from $88 and the effective
 * address wraps within page 0. When nothing is in-band the routine returns untouched. [code]
 */
export function maybeDecrementTableEntry(m) {
  const { mem8 } = m;
  const v = mem8[TILEMAP_PTR_LO] & 0x1f;
  const bandLow = mem8[loc_ef] === 0; // loc_ef == 0 selects the low band (< 0x0c); else the high band (>= 0x14)
  const decrement = bandLow ? v < 0x0c : v >= 0x14;
  if (!decrement) return;
  const ea = (loc_d7 + mem8[loc_88]) & 0xff; // dec $d7,x — zero-page,X wraps in page 0
  mem8[ea] = mem8[ea] - 1;                    // store through mem8 truncates (dec of 0 wraps to 0xff)
}
