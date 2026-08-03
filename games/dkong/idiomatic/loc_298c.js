// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_298c — is the background tile just ahead of the current object outside the
 * accepted tile band?  ROM 0x298C.
 *
 * Reads the object record currently being iterated (OBJ_ITER_PTR), takes that
 * object's Y and X fields, shifts the X 12 pixels along, maps the resulting pixel
 * to its tilemap cell, and inspects the tile living there. The answer is a plain
 * predicate on that tile:
 *
 *   • tile value below 0xB0                  -> OUT of band  (true)
 *   • tile value >= 0xB0 with low nibble >= 8 -> OUT of band  (true)
 *   • tile value >= 0xB0 with low nibble 0..7 -> IN band     (false)
 *
 * so the accepted band is the tiles 0xB0..0xB7, 0xC0..0xC7, … 0xF0..0xF7 — the
 * high half of the tile set with the low nibble kept under 8. The caller branches
 * on the result while walking its object list, so this reports "the cell 12px ahead
 * of the object is not one of the accepted tiles."
 *
 * The record pointer's low byte is advanced to reach the two fields WITHOUT
 * carrying into the page byte, so a field offset that overruns 0xFF wraps back
 * inside the same 256-byte page rather than spilling into the next page.
 *
 * NAME: kept the neutral loc_ — the tile test and its inputs are pinned to the
 * oracle, but which gameplay decision the caller makes from it is not grounded to
 * the routine-name bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-298c.test.js.
 * GATE:     captured + crafted. 0x298C is dispatched ~285×/2000 attract frames, so
 *           real captured dispatches exercise it against natural object records;
 *           crafted entries then pin every tile-band edge (below 0xB0, the 0xB0 and
 *           0xB7 in-band edges, the low-nibble-8 out edge, an all-nibbles-set tile)
 *           and the low-byte page wrap on the record fields. Teeth: a wrong tile
 *           threshold, a dropped low-nibble check, a dropped X probe offset, and a
 *           record read that does not confine the wrap to the page.
 * LIVE-OUT: the verdict, returned BOTH as a boolean AND in register A (1 = out of
 *           band, 0 = in band). A is load-bearing, not residual: the caller (ROM
 *           0x3202, at 0x3241) is still translated and consumes the answer with
 *           `cp 0x01`, so A is this routine's register boundary until that caller is
 *           rewritten. The routine writes NO memory — it is read-only — and every
 *           other residual register is dead ABI, as are the flags (the caller's
 *           `cp 0x01` recomputes them from A).
 * NAMES:    OBJ_ITER_PTR (0x63c8) from ram.js. The record field offsets +0x0e/+0x0f
 *           and the 12px probe offset are object-record structure, not ram.js cells;
 *           the tile band (0xB0, low nibble < 8) is an irreducible value test. The
 *           tilemap VRAM base lives inside tileAddrForPixel, not here.
 */

import { OBJ_ITER_PTR } from "./ram.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js"; // ROM 0x2FF0 — pixel -> tilemap cell

const REC_Y = 0x0e;          // object-record field: Y coordinate
const REC_X = 0x0f;          // object-record field: X coordinate
const X_PROBE = 0x0c;        // probe 12 pixels along X from the record's own X
const TILE_FLOOR = 0xb0;     // tiles below this are out of band
const NIBBLE_LIMIT = 0x08;   // in-band tiles keep their low nibble under this

/**
 * @param {object} m  the machine (uses m.mem only; read-only).
 * @returns {boolean} true when the probed tile is OUTSIDE the accepted band.
 */
export function loc_298c(m) {
  const { regs, mem } = m;

  // The object record being iterated. Field offsets advance the low byte only,
  // so they stay confined to the record's own 256-byte page.
  const rec = mem.read16(OBJ_ITER_PTR);
  const page = rec & 0xff00;

  // Probe point: the record's Y, and its X carried 12 pixels along.
  const y = mem.read8(page | ((rec + REC_Y) & 0xff));
  const x = mem.read8(page | ((rec + REC_X) & 0xff)) + X_PROBE;

  // The tile occupying that pixel's cell.
  const tile = mem.read8(tileAddrForPixel(y, x));

  // Out of band below the floor, or once the low nibble reaches 8.
  //
  // The verdict is handed back BOTH ways. The JS boolean is what idiomatic callers
  // read; A is what the still-translated caller at ROM 0x3241 reads (`cp 0x01`),
  // exactly as the oracle leaves it (`ld a,0x01` / `xor a`). Returning the boolean
  // alone leaves A holding whatever the preceding `call 0x33ad` left there, and the
  // caller then mis-branches on it.
  if (tile < TILE_FLOOR) return verdict(true);
  if ((tile & 0x0f) >= NIBBLE_LIMIT) return verdict(true);
  return verdict(false);

  function verdict(outOfBand) {
    regs.a = outOfBand ? 0x01 : 0x00;
    return outOfBand;
  }
}
