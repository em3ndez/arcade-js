// SPDX-License-Identifier: GPL-3.0-only
/**
 * decideSlopeGirderFooting — on a slope tile, decide whether Mario keeps his footing or the ground
 * has run out and he falls. He falls when exactly column-aligned (no girder edge underfoot), or
 * when the tile one row up is not a solid girder; a solid girder overhead keeps him on the slope.
 * The probe X and foot-cell pointer arrive in registers.
 *
 * LIVE-OUT: memory-only — the one-shot fall request, raised on the fall branches only.
 */

import { u16 } from "../../../core/int.js";
import { triggerMarioFall } from "./triggerMarioFall.js";

const ONE_ROW = 0x20;

export function decideSlopeGirderFooting(m, d = m.regs.d, hl = m.regs.hl) {
  const { regs, mem8 } = m;

  const probeX = d;
  if ((probeX & 0x07) === 0) return triggerMarioFall(m);

  const upperTile = mem8[u16(hl - ONE_ROW)];

  // Solid girder = code >= 0xB0 with low nibble under 8; anything else is not ground.
  if (upperTile < 0xb0) return triggerMarioFall(m);
  if ((upperTile & 0x0f) >= 8) return triggerMarioFall(m);
}
