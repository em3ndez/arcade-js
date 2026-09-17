// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d51 — reload the barrel's path cursor from RAM, then take the next waypoint.
 *
 * LIVE-OUT: memory-only — every byte written happens inside the per-waypoint body.
 */

import { RENDER_STR_PTR } from "./names.js";
import { stepBarrelAlongReleasePath } from "./stepBarrelAlongReleasePath.js";

export function loc_2d51(m) {
  const { regs, mem16 } = m;
  regs.hl = mem16[RENDER_STR_PTR];
  return stepBarrelAlongReleasePath(m);
}
