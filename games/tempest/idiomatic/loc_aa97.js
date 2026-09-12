// SPDX-License-Identifier: GPL-3.0-only
import { loc_3d } from "./names.js";
import { loc_b0dd } from "./loc_b0dd.js";
import { loc_aa9e } from "./loc_aa9e.js";

// Publish a zero header value, then emit the run for the slot named by a scratch byte.
export function loc_aa97(m) {
  const { mem8 } = m;
  loc_b0dd(m, 0x00);
  return loc_aa9e(m, mem8[loc_3d]);
}
