// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { countStepsToThreshold } from "./countStepsToThreshold.js";
import { loc_2009 } from "./names.js";

/**
 * scaleXToBlock — map a screen X coordinate onto the fleet's coarse grid (screen -> block).
 *
 * WHAT IT IS
 *   The inverse of the routine that places aliens: it turns a pixel X coordinate into a coarse
 *   16-pixel block index plus a leftover residual. The fleet's whole position is tracked by one
 *   reference corner; the X half of that corner lives at loc_2009 (0x2009). This routine steps that
 *   reference base up by 0x10 (16 pixels, one grid step) at a time until it reaches the coordinate
 *   passed in L (the coordinate is used as the threshold), and reports how many steps that took.
 *   The step count less one is the block index in B; the leftover is the residual in L/A.
 *
 * ROLE IN THE MACHINE
 *   Screen-to-grid twin of scaleYToBlock (which does the same with loc_200a stepped up to a coordinate
 *   in H). Both share the very reference cells that place the aliens (loc_2009/loc_200a — still open
 *   [guess]), so grid-to-screen and screen-to-grid use one origin. Called from the player-shot hit
 *   resolver (resolvePlayerShotHit) to find which grid cell a point falls in. The counting is done by
 *   countStepsToThreshold (0x1554), which pre-normalizes a negative value upward first. NOTE: whether
 *   loc_2009/loc_200a are literally the X/Y pair — and thus whether the "X" label is literal — is not
 *   yet pinned down.
 *
 * ROM 0x1562.  Grounding: [seen] (reference cell loc_2009 role open [guess]).
 *
 * LIVE-OUT: B = block index (steps - 1), A = L = residual (stepped value - 0x10).
 */
export function scaleXToBlock(m, l = m.regs.l) {
  // Step the reference base at loc_2009 up in 0x10 increments until it reaches the coordinate in L
  // (L is the threshold). `stepped` is the value once it has crossed; `count` is how many steps.
  const [stepped, count] = countStepsToThreshold(m, m.mem8[loc_2009], l);
  // The residual is how far into the final block the coordinate sits: the stepped value minus one
  // whole 0x10 block (i.e. the value one step before it crossed the threshold).
  const residual = u8(stepped - 0x10);
  // Publish: block index B = count - 1 (0-based), residual mirrored into both A and L.
  return [(m.regs.a = residual), (m.regs.l = residual), (m.regs.b = u8(count - 1))];
}
