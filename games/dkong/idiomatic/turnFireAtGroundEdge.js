// SPDX-License-Identifier: GPL-3.0-only
/**
 * turnFireAtGroundEdge — report that a fire has reached the edge of the ground it walks on; the
 * sole determinant its caller uses to turn the fire around.
 *
 * Reads the iterated fire record (OBJ_ITER_PTR) and probes the tile GROUND_PROBE_DROP pixels below
 * the fire — the same axis and offset Mario's ground test uses, not ahead of the fire. Out of band
 * when the tile is below TILE_FLOOR, or its low nibble reaches NIBBLE_LIMIT; that band's end is the
 * ground edge. Field offsets advance the low byte only, wrapping inside the record's own page.
 *
 * LIVE-OUT: the verdict, handed back BOTH as a boolean AND in register A (1 = out of band, 0 = in
 * band) — a caller that compares a register would mis-branch on a stale A otherwise.
 */

import { page } from "../../../core/int.js";
import { OBJ_ITER_PTR } from "./names.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js";

const REC_WORKING_X = 0x0e;
const REC_WORKING_Y = 0x0f;
const GROUND_PROBE_DROP = 0x0c; // probe 12 pixels BELOW the fire, not ahead of it
const TILE_FLOOR = 0xb0;
const NIBBLE_LIMIT = 0x08;

/** @returns {number} 1 when the probed tile is OUTSIDE the accepted band, else 0. */
export function turnFireAtGroundEdge(m) {
  const { regs, mem8, mem16 } = m;

  const rec = mem16[OBJ_ITER_PTR];
  const recPage = page(rec);

  const workingX = mem8[recPage | ((rec + REC_WORKING_X) & 0xff)];
  const groundY = mem8[recPage | ((rec + REC_WORKING_Y) & 0xff)] + GROUND_PROBE_DROP;

  const tile = mem8[tileAddrForPixel(workingX, groundY)];

  if (tile < TILE_FLOOR) return verdict(true);
  if ((tile & 0x0f) >= NIBBLE_LIMIT) return verdict(true);
  return verdict(false);

  function verdict(outOfBand) {
    return (regs.a = outOfBand ? 0x01 : 0x00);
  }
}
