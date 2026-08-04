// SPDX-License-Identifier: GPL-3.0-only
/**
 * startMarioFallWhenGroundGivesWay — while Mario is in plain grounded contact, look at the
 * tile under his foot and, if the girder there is not level, defer to the slope-footing fall
 * check.
 *
 * Runs only in ordinary standing/walking contact: it early-outs if Mario is on a ladder, if
 * he is airborne, or while an edge-reposition is in progress. Past those three gates it
 * samples the tilemap cell just under his foot (3 px back along his X, 12 px along his Y) and
 * reads that tile:
 *   - A solid flat girder there — a tile code at or above 0xB0 whose low nibble is under 8 —
 *     means level footing, and there is nothing to do.
 *   - Anything else (a slope tile, or a girder tile whose low nibble is 8 or more) means the
 *     ground may be angled or gone under him, so it hands off to the slope-footing decision,
 *     which chooses between keeping his footing on the slope and starting a fall.
 *
 * The 90-degree display rotation is why the foot cell is addressed with Mario's X coordinate
 * feeding the tilemap's VERTICAL axis and his Y coordinate feeding the HORIZONTAL one; the
 * shared pixel-to-tile helper assumes exactly that.
 *
 * WHY THE NAME SAYS "START A FALL": the whole cascade below this routine has exactly ONE
 * memory effect — the slope decision's two fall branches raise MARIO_START_FALL, and its
 * keeps-footing branch writes nothing at all. MARIO_START_FALL is consumed by the
 * player-state reset, which clears it and puts Mario AIRBORNE. So the only thing this routine
 * can cause is Mario STARTING to fall; everything else about it is the "when". Nothing in the
 * cascade writes MARIO_Y, which is why the verb is "start" and not "drop".
 *
 * LIVE-OUT: memory-only — MARIO_START_FALL, raised inside the slope decision on its fall
 * branches. Every other path writes nothing. The caller tail-invokes this and consumes no
 * value.
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
  const { regs, mem } = m;

  // Grounded-contact gates: do nothing while Mario is on a ladder, airborne, or an
  // edge-reposition is in progress.
  if (mem.read8(MARIO_ON_LADDER) !== 0) return;
  if (mem.read8(MARIO_AIRBORNE) !== 0) return;
  if (mem.read8(EDGE_REPOSITION_FLAG) === 1) return;

  // Foot-probe coordinate: 3 px back along Mario's X, 12 px along his Y. The 90-degree
  // rotation feeds his X to the tilemap's vertical axis and his Y to the horizontal one.
  const probeX = (mem.read8(MARIO_X) - 3) & 0xff;
  const probeY = (mem.read8(MARIO_Y) + 0x0c) & 0xff;
  const footCell = tileAddrForPixel(probeX, probeY);

  const tile = mem.read8(footCell);

  // Not a solid flat girder (slope tile, or girder tile with a low nibble of 8+): defer to
  // the slope-footing decision, which reads the probe-X and foot-cell pointer from registers.
  if (tile < 0xb0 || (tile & 0x0f) >= 8) {
    regs.d = probeX;
    regs.hl = footCell;
    return decideSlopeGirderFooting(m);
  }

  // Solid flat girder under the foot: level footing, nothing to do.
}
