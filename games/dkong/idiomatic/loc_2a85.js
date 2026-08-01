// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a85 — while Mario is in plain grounded contact, look at the tile under his foot and,
 * if the girder there is not level, defer to the slope-footing fall check.  ROM 0x2A85.
 *
 * Runs only in ordinary standing/walking contact: it early-outs if Mario is on a ladder, if
 * he is airborne, or while an edge-reposition is in progress. Past those three gates it
 * samples the tilemap cell just under his foot (3 px back along his X, 12 px along his Y) and
 * reads that tile:
 *   - A solid flat girder there — a tile code at or above 0xB0 whose low nibble is under 8 —
 *     means level footing, and there is nothing to do.
 *   - Anything else (a slope tile, or a girder tile whose low nibble is 8 or more) means the
 *     ground may be angled or gone under him, so it hands off to decideSlopeGirderFooting,
 *     which chooses between keeping his footing on the slope and starting a fall.
 *
 * The 90-degree display rotation is why the foot cell is addressed with Mario's X coordinate
 * feeding the tilemap's vertical axis and his Y coordinate feeding the horizontal one — see
 * tileAddrForPixel, which the ROM's own address arithmetic assumes.
 *
 * NAME: kept the neutral loc_ — the gates and the tile dispatch are pinned to the oracle, but
 * exactly which grounded-contact event this services (versus its sibling sub_2a2f) is not
 * confirmed to the routine-name bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2a85.test.js.
 * GATE:     capture/clone/replay of real attract dispatches (the keeps-footing exit and the
 *           gate returns) + crafted entries driving each of the three gate returns and both
 *           slope-cascade arms (tile < 0xB0, and low-nibble >= 8). The
 *           slope->decideSlopeGirderFooting hand-off is a non-attract frontier. The RAM diff
 *           excludes the dead STACK_SCRATCH the oracle's push/pop bracket around the foot-cell
 *           lookup writes. Teeth: drop the on-ladder gate, drop the edge-reposition gate, and
 *           an off-by-one solid-tile threshold.
 * LIVE-OUT: memory-only (MARIO_START_FALL, raised inside decideSlopeGirderFooting on its fall
 *           branches; every other path writes nothing). The oracle's residual registers/flags
 *           and its terminal ret / tail jump into the slope check are dead — the caller
 *           tail-invokes this and consumes no value.
 * NAMES:    MARIO_ON_LADDER (0x6215), MARIO_AIRBORNE (0x6216), EDGE_REPOSITION_FLAG (0x6398),
 *           MARIO_X (0x6203), MARIO_Y (0x6205) — from ram.js. The foot-cell address is computed
 *           by tileAddrForPixel (ROM 0x2FF0) and lands in tilemap video RAM (no ram.js name).
 *           decideSlopeGirderFooting (ROM 0x2AB4) reads its probe-X and foot-cell inputs from
 *           registers because this still-translated routine is its register boundary.
 */

import { tileAddrForPixel } from "./tileAddrForPixel.js";                // ROM 0x2FF0
import { decideSlopeGirderFooting } from "./decideSlopeGirderFooting.js"; // ROM 0x2AB4
import {
  MARIO_ON_LADDER,
  MARIO_AIRBORNE,
  EDGE_REPOSITION_FLAG,
  MARIO_X,
  MARIO_Y,
} from "./ram.js";

export function loc_2a85(m) {
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
