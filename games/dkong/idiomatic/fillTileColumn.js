// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileColumn — fill a tilemap column with a kind-selected tile.
 *
 * The arm of the board-layout renderer that handles segment records of kind 4, 5 and 6. Each
 * record's kind byte has already been stashed in the render scratch; this arm draws a solid
 * vertical run of one tile:
 *
 *   - The kind picks the fill tile code — 4 and 5 each have their own, and 6 (along with any
 *     other kind that reaches the fill) takes the default — and it is stashed in SEG_TILE.
 *   - The fill runs DOWN the tilemap from the record's already-converted address in SEG_ADDR1,
 *     the cell the record's corner fell in: lay the tile, step one whole tilemap row, and pay the
 *     remaining column height in SEG_HEIGHT down by one tile's worth of pixels. It always lays at
 *     least one tile and keeps going while height remains.
 *   - A kind of 7 or more bails without drawing anything and only advances the record pointer.
 *     The test is a SIGN test rather than an unsigned compare; the two agree only because real
 *     kinds are small.
 *
 * Both exits step the record pointer one byte past this record, and control returns to the walk
 * that is stepping through the records.
 *
 * A LEAF: it reads the record kind, the render scratch and the record pointer; it writes SEG_TILE,
 * SEG_HEIGHT, the tilemap, and the record pointer.
 *
 * LIVE-OUT: memory (SEG_TILE, SEG_HEIGHT and the tilemap cells) plus the record pointer, which the
 * walk reads as the next record's address.
 */

import { SEG_ADDR1, SEG_HEIGHT, SEG_KIND, SEG_TILE } from "./names.js";

export function fillTileColumn(m) {
  const { regs, mem } = m;

  // The record walk stashes the current record's kind here.
  const kind = mem.read8(SEG_KIND);

  // A SIGN test, not an unsigned compare: kinds that leave the subtraction non-negative bail,
  // and kinds 4/5/6 — the only ones routed here — fall through. A bail draws nothing and only
  // steps the record pointer.
  if (((kind - 0x07) & 0x80) === 0) {
    regs.de = (regs.de + 1) & 0xffff;
    return;
  }

  // Kind picks the fill tile-code; 6 (and any other non-4/5 kind) is the default.
  let tile;
  if (kind === 0x04) tile = 0xe0;
  else if (kind === 0x05) tile = 0xb0;
  else tile = 0xfe;

  // Stash the chosen tile, then fill down the column from the record's converted tilemap
  // address (loaded ONCE — the loop writes only the tilemap and the remaining height, so the
  // tile code is loop-invariant).
  mem.write8(SEG_TILE, tile);
  let addr = mem.read16(SEG_ADDR1);
  for (;;) {
    mem.write8(addr, tile);              // lay the tile
    addr = (addr + 0x20) & 0xffff;       // step one whole tilemap row
    const height = mem.read8(SEG_HEIGHT); // remaining column height, in pixels
    mem.write8(SEG_HEIGHT, (height - 0x08) & 0xff);
    if (height < 0x08) break;            // height spent — the column is done
  }

  // Step the record pointer one past this record; the walk resumes at the next one.
  regs.de = (regs.de + 1) & 0xffff;
}
