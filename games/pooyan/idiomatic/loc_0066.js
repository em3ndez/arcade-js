// SPDX-License-Identifier: GPL-3.0-only
import { loc_066d } from "./loc_066d.js";

/**
 * loc_0066 — the Z80 NMI vector: a bare jump to the vblank service routine. The trailing bytes
 * in its range are an unreached data region.
 */
export function loc_0066(m) {
  return loc_066d(m);
}
