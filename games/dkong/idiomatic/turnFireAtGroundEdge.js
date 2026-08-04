// SPDX-License-Identifier: GPL-3.0-only
/**
 * turnFireAtGroundEdge — report that a fire has reached the edge of the ground it is walking on.
 * The answer is the SOLE determinant its caller uses to turn the fire around.
 *
 * It reads the fire record currently being iterated (OBJ_ITER_PTR), takes that record's two working
 * coordinates, and probes the tile GROUND_PROBE_DROP pixels BELOW the fire — the same axis and the
 * same offset Mario's own ground test uses. It does NOT look ahead of the fire; the axis the fire
 * travels along is left exactly as the record holds it.
 *
 * The answer is a plain predicate on the tile found there:
 *
 *   • tile below TILE_FLOOR                        -> OUT of band  (true)
 *   • tile at or above it, low nibble >= NIBBLE_LIMIT -> OUT of band  (true)
 *   • tile at or above it, low nibble under it     -> IN band      (false)
 *
 * so the accepted band is the high half of the tile set with the low nibble kept under 8. Ground
 * ends where that band ends, which is why an out-of-band answer is an EDGE and not just a different
 * tile.
 *
 * The record pointer's low byte is advanced to reach the two fields WITHOUT carrying into the page
 * byte, so a field offset that overruns the byte wraps back inside the same 256-byte page rather
 * than spilling into the next one.
 *
 * The routine writes NO memory — it is read-only.
 *
 * LIVE-OUT: the verdict, handed back BOTH as a boolean AND in register A (1 = out of band, 0 = in
 * band). A is load-bearing rather than residual: the caller consumes the answer as a register
 * comparison, so A stays this routine's register boundary. Every other residual register is dead,
 * as are the flags — the caller's own comparison recomputes them from A.
 */

import { OBJ_ITER_PTR } from "./names.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js"; // pixel -> tilemap cell

const REC_WORKING_X = 0x0e;    // fire-record field: the working X, left untouched by the probe
const REC_WORKING_Y = 0x0f;    // fire-record field: the working Y, the axis the probe moves down
const GROUND_PROBE_DROP = 0x0c; // probe 12 pixels BELOW the fire, not ahead of it
const TILE_FLOOR = 0xb0;       // tiles below this are out of band
const NIBBLE_LIMIT = 0x08;     // in-band tiles keep their low nibble under this

/**
 * @param {object} m  the machine (uses m.mem only; read-only).
 * @returns {boolean} true when the probed tile is OUTSIDE the accepted band.
 */
export function turnFireAtGroundEdge(m) {
  const { regs, mem } = m;

  // The fire record being iterated. Field offsets advance the low byte only,
  // so they stay confined to the record's own 256-byte page.
  const rec = mem.read16(OBJ_ITER_PTR);
  const page = rec & 0xff00;

  // Probe point: the fire's own working X, and its working Y carried 12 pixels DOWN.
  const workingX = mem.read8(page | ((rec + REC_WORKING_X) & 0xff));
  const groundY = mem.read8(page | ((rec + REC_WORKING_Y) & 0xff)) + GROUND_PROBE_DROP;

  // The tile occupying that spot. The helper takes the pair in record order.
  const tile = mem.read8(tileAddrForPixel(workingX, groundY));

  // Out of band below the floor, or once the low nibble reaches the limit.
  //
  // The verdict is handed back BOTH ways. The boolean is what a direct caller reads; A is what a
  // caller that compares a register reads. Returning the boolean alone would leave A holding
  // whatever the preceding call left there, and such a caller then mis-branches on it.
  if (tile < TILE_FLOOR) return verdict(true);
  if ((tile & 0x0f) >= NIBBLE_LIMIT) return verdict(true);
  return verdict(false);

  function verdict(outOfBand) {
    regs.a = outOfBand ? 0x01 : 0x00;
    return outOfBand;
  }
}
