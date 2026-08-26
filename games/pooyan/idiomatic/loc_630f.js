// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { markHitFlagSeedActorAndScanEnemyRecords } from "./markHitFlagSeedActorAndScanEnemyRecords.js";
import { FLIP_SCREEN_FLAG } from "./names.js";
/**
 * loc_630f — tight bounding-box proximity test for one dispatch kind.
 *
 * Both axis gaps between the flip-biased actor and the target must fall inside a small box. Out
 * of range on either axis skips the record to the epilogue; inside the box engages the hit.
 *
 * LIVE-OUT: a boolean — true = normal completion, false = a caller-skip must unwind the frame.
 */
const GAP_LIMIT = 0x05;

export function loc_630f(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  if (Math.abs(mem8[iy] - ax) >= GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  return markHitFlagSeedActorAndScanEnemyRecords(m, hl, ireg); // hit
}
