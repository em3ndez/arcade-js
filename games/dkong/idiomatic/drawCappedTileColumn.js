// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCappedTileColumn — stamp a capped vertical tile run (top cap, body, bottom cap) down
 * the tilemap for a kind-3 board-layout record.
 *
 * The kind-3 arm of the board-layout drawer chain. The layout is a table of segment records;
 * each record's kind byte is stashed in SEG_KIND and dispatched down the chain — kind 2 to
 * the ladder drawer, kind 3 to here, kind 4 and up to the uniform column fill. The ladder
 * drawer tails to this routine for every record that is not kind 2; this routine handles kind
 * exactly 3 and hands kind 4 and up straight on to the uniform fill.
 *
 * Kind 3 lays a CAPPED vertical run down the tilemap, from the record's converted tilemap
 * address SEG_ADDR1 — the tile the record's corner fell in — sized by the segment height
 * SEG_HEIGHT:
 *   - a TOP cap tile at the record's address,
 *   - then BODY tiles, each stepping one whole tilemap row down (the map is 32 cells wide)
 *     and paying the extent down: 16 pixels on the first step, because the top cap is two
 *     tiles tall, then 8 pixels for each body row after,
 *   - a BOTTOM cap on the row where the extent subtraction borrows.
 * Then it steps the record pointer one past the record and re-enters the walk.
 *
 * The extent counter LIVES IN SEG_HEIGHT — reloaded, decremented and stored every body row,
 * not a hidden local — so its per-row intermediate values are observable in work RAM.
 * `extent` below mirrors that byte; nothing aliases it between the store and the reload, so
 * the reload is folded away. Contrast the uniform fill this delegates to: it draws one tile
 * with a flat 8-pixel step and no caps, where this one has distinct top/body/bottom tiles and
 * a 16-pixel first step.
 *
 * LIVE-OUT: memory (SEG_HEIGHT and the tilemap cells) plus the record pointer, advanced one
 * past this record — the walk reads it as the next record's address.
 */

import { SEG_ADDR1, SEG_HEIGHT, SEG_KIND } from "./names.js";
import { fillTileColumn } from "./fillTileColumn.js";

export function drawCappedTileColumn(m) {
  const { regs, mem } = m;

  // The layout walk stashes the current record's kind here.
  const kind = mem.read8(SEG_KIND);

  // Kind 4+ is not ours: hand it to the uniform column filler (kinds 4/5/6 select a fill
  // tile; kind >= 7 bails, drawing nothing). That filler advances the record pointer itself,
  // so there is nothing more to do here.
  if (kind !== 0x03) {
    fillTileColumn(m);
    return;
  }

  // Kind exactly 3: lay the capped vertical run from the record's converted tilemap
  // address. Top cap first, then step one whole tilemap row down.
  let addr = mem.read16(SEG_ADDR1);
  mem.write8(addr, 0xb3);          // TOP cap
  addr = (addr + 0x20) & 0xffff;   // step one tilemap row (map is 0x20 cells wide)

  // Pay the extent down: 16 on the first step, 8 each body row after. A borrow — the extent
  // dropped below the step — ends the run on the current row.
  const extent0 = mem.read8(SEG_HEIGHT);
  let extent = (extent0 - 0x10) & 0xff;   // first step spends 16 (top cap = 2 tiles)
  let spent = extent0 < 0x10;             // did that first subtraction borrow?
  for (;;) {
    if (spent) {
      mem.write8(addr, 0xb2);             // BOTTOM cap on the borrowing row
      break;
    }
    mem.write8(SEG_HEIGHT, extent);       // store the decremented extent (observable)
    mem.write8(addr, 0xb1);               // BODY tile
    addr = (addr + 0x20) & 0xffff;        // step one tilemap row
    spent = extent < 0x08;                // next borrow test
    extent = (extent - 0x08) & 0xff;      // ...each body row spends 8
  }

  // Both the kind-3 exit and the delegated path leave the record pointer one past this
  // record; the walk resumes at the next one.
  regs.de = (regs.de + 1) & 0xffff;
}
