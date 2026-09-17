// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCappedTileColumn — the kind-3 arm of the board-layout drawer: stamp a capped vertical tile
 * run (top cap, body, bottom cap) down the tilemap from the record's converted address SEG_ADDR1,
 * sized by SEG_HEIGHT, then step the record pointer one past the record. Kind 4+ is handed to the
 * uniform column fill. The extent counter lives in SEG_HEIGHT, stored every body row.
 *
 * LIVE-OUT: memory (SEG_HEIGHT and the tilemap cells) plus the record pointer, advanced one past
 * this record — the walk reads it as the next record's address.
 */

import { SEG_ADDR1, SEG_HEIGHT, SEG_KIND } from "./names.js";
import { fillTileColumn } from "./fillTileColumn.js";

export function drawCappedTileColumn(m) {
  const { regs, mem8, mem16 } = m;

  const kind = mem8[SEG_KIND];

  // Kind 4+ is not ours: the uniform filler advances the record pointer itself.
  if (kind !== 0x03) {
    fillTileColumn(m);
    return;
  }

  let addr = mem16[SEG_ADDR1];
  mem8[addr] = 0xb3;               // TOP cap
  addr = (addr + 0x20) & 0xffff;   // step one tilemap row (map is 0x20 cells wide)

  // Pay the extent down: 16 on the first step (top cap = 2 tiles), 8 each body row after.
  const extent0 = mem8[SEG_HEIGHT];
  let extent = (extent0 - 0x10) & 0xff;
  let spent = extent0 < 0x10;             // did that first subtraction borrow?
  for (;;) {
    if (spent) {
      mem8[addr] = 0xb2;                  // BOTTOM cap on the borrowing row
      break;
    }
    mem8[SEG_HEIGHT] = extent;            // store the decremented extent (observable)
    mem8[addr] = 0xb1;                    // BODY tile
    addr = (addr + 0x20) & 0xffff;
    spent = extent < 0x08;
    extent = (extent - 0x08) & 0xff;
  }

  regs.de = (regs.de + 1) & 0xffff;
}
