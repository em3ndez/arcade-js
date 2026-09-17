// SPDX-License-Identifier: GPL-3.0-only
/**
 * startMarioFallWhenGroundGivesWay — while Mario is in plain grounded contact, look at the tile
 * under his foot and, if the girder there is not level, defer to the slope-footing fall check.
 * Early-outs if he is on a ladder, airborne, or an edge-reposition is in progress.
 *
 * LIVE-OUT: memory-only — MARIO_START_FALL, raised inside the slope decision on its fall branches.
 */

import { tileAddrForPixel } from "./tileAddrForPixel.js";
import { decideSlopeGirderFooting } from "./decideSlopeGirderFooting.js";
import {
  MARIO_ON_LADDER,
  MARIO_AIRBORNE,
  EDGE_REPOSITION_FLAG,
  MARIO_X,
  MARIO_Y,
} from "./names.js";

export function startMarioFallWhenGroundGivesWay(m) {
  const { regs, mem8 } = m;

  if (mem8[MARIO_ON_LADDER] !== 0) return;
  if (mem8[MARIO_AIRBORNE] !== 0) return;
  if (mem8[EDGE_REPOSITION_FLAG] === 1) return;

  // Foot-probe cell: 3 px back along X, 12 px along Y. The 90-degree rotation feeds X to the
  // tilemap's vertical axis and Y to the horizontal one.
  const probeX = (mem8[MARIO_X] - 3) & 0xff;
  const probeY = (mem8[MARIO_Y] + 0x0c) & 0xff;
  const footCell = tileAddrForPixel(probeX, probeY);

  const tile = mem8[footCell];

  // Not a solid flat girder (slope tile, or girder tile with low nibble 8+): defer to the
  // slope-footing decision, which reads probe-X and the foot-cell pointer from registers.
  if (tile < 0xb0 || (tile & 0x0f) >= 8) {
    regs.d = probeX;
    regs.hl = footCell;
    return decideSlopeGirderFooting(m);
  }

  // Solid flat girder under the foot: level footing, nothing to do.
}
