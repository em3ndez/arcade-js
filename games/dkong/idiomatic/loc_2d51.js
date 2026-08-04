// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d51 — reload the barrel's path cursor from RAM, then take the next waypoint.
 *
 * The per-waypoint loop entry of the barrel-release path walk: the release driver hands
 * control here once per waypoint. It reloads the current cursor from RENDER_STR_PTR and
 * falls straight into the per-waypoint body, which consumes one two-byte waypoint, publishes
 * the barrel's pose as a hardware sprite, and stores the advanced cursor back. Reloading
 * here is what walks the path one waypoint further on every entry, until the 0x7F
 * end-of-path sentinel is reached.
 *
 * NOT A CHARACTER RENDERER, whatever the cursor cell is called: the table being walked is
 * (x, y) waypoint PAIRS — the first byte of each pair becomes the sprite's X and the second
 * its Y — and nothing on this path writes video RAM.
 *
 * This chain runs in ordinary 25m barrel play, one walk per barrel released onto the
 * girders, not in a cutscene.
 *
 * The body takes its cursor in a register, so the freshly reloaded value is handed over
 * there; that is this routine's own reload, not extra marshalling.
 *
 * LIVE-OUT: memory-only — every byte written happens inside the per-waypoint body and the
 * release-completion step it can hand off to.
 */

import { RENDER_STR_PTR } from "./names.js";
import { stepBarrelAlongReleasePath } from "./stepBarrelAlongReleasePath.js";

export function loc_2d51(m) {
  const { regs, mem } = m;

  // Reload the path cursor from RAM and take the next waypoint. The body reads its cursor
  // from the register, so hand it the freshly-loaded value.
  regs.hl = mem.read16(RENDER_STR_PTR);
  return stepBarrelAlongReleasePath(m);
}
