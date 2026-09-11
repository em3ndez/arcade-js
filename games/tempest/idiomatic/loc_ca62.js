// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_40 } from "./names.js";

// Zero the six-byte working block starting at the base cell.
export function loc_ca62(m) {
  const { mem8 } = m;
  for (let x = 5; x >= 0; x--) mem8[u8(loc_40 + x)] = 0x00;
  return;
}
