// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCappedTileColumn — stamp a capped vertical tile run (top cap, body, bottom
 * cap) down the tilemap for a kind-3 board-layout record.  ROM 0x0EE8.
 *
 * The kind-3 arm of the board-layout drawer chain. The layout is a table of segment
 * records walked by sub_0da7; each record's kind byte is stashed in SEG_KIND (0x63B3)
 * and dispatched down the chain — kind 2 -> loc_0e4f (the ladder drawer), kind 3 ->
 * here, kind 4+ -> fillTileColumn (the uniform column fill). loc_0e4f tails to this
 * routine for every record that is not kind 2; this routine handles kind exactly 3
 * and hands kind 4+ straight on to fillTileColumn.
 *
 * Kind 3 lays a CAPPED vertical run down the tilemap, from the record's converted
 * VRAM address SEG_ADDR1 (0x63AB, the tile the record's corner fell in), sized by the
 * segment height SEG_HEIGHT (0x63B1):
 *   - a TOP cap (tile 0xB3) at the record's address,
 *   - then BODY tiles (0xB1), each stepping HL one whole tilemap row (+0x20, the map
 *     is 0x20 cells wide) and paying the extent down — 0x10 px on the first step
 *     (the top cap is two tiles tall), 0x08 px each body row after,
 *   - a BOTTOM cap (tile 0xB2) on the row where the extent subtraction borrows.
 * Then it steps DE (the record pointer) one past the record and re-enters the walk.
 *
 * The extent counter LIVES IN SEG_HEIGHT (0x63B1) — reloaded, decremented, and stored
 * every body row by the oracle, not a hidden local — so its per-row intermediate values
 * are observable in work RAM; `extent` below mirrors that byte (nothing aliases it
 * between the store and the reload, so the reload is folded away). Contrast the
 * sibling fillTileColumn: it draws one uniform tile with a flat 0x08 step and no
 * caps; this one has distinct top/body/bottom tiles and a 0x10 first step.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0ee8.test.js.
 * GATE:     crafted-entry — loc_0ee8 is UNREACHED in attract (the attract board's
 *           segment records are all kind 2, so loc_0e4f never tails here), so states
 *           are captured at its live sibling loc_0e4f, which shares the exact
 *           render-scratch this routine consumes (SEG_ADDR1 0x63AB tilemap ptr,
 *           SEG_HEIGHT 0x63B1 extent, SEG_KIND 0x63B3 kind, DE record ptr), and the
 *           kind + extent are nudged to reach
 *           every arm (the kind-3 capped column at real and crafted extents — the
 *           multi-row run, the one-row run, and the immediate bottom cap — plus each
 *           kind-4+ delegation arm), identically on both sides.
 * LIVE-OUT: memory + DE. Memory = SEG_HEIGHT (0x63B1, extent) and the tilemap VRAM
 *           cells (top / body / bottom tiles). DE = the record pointer advanced one past this
 *           record; the walk (sub_0da7) reads it as the next record's address with
 *           `ld a,(de)`. A/HL/BC and all flags are dead — sub_0da7 reloads them
 *           before reading. SP is unchanged (no stack use) and IS compared; pc is the
 *           dropped control-flow model (the oracle's `jp 0x0DA7` back-edge becomes
 *           this JS return), asserted unchanged on the candidate rather than compared
 *           against the oracle's m.step-threaded pc.
 * NAMES:    SEG_ADDR1 (0x63AB, first-endpoint tile address), SEG_HEIGHT (0x63B1, column
 *           extent), SEG_KIND (0x63B3, record kind) from ram.js — the line-segment
 *           render-scratch block.
 */

import { SEG_ADDR1, SEG_HEIGHT, SEG_KIND } from "./ram.js";
import { fillTileColumn } from "./fillTileColumn.js";

export function drawCappedTileColumn(m) {
  const { regs, mem } = m;

  // The walk (sub_0da7) stashes the current record's kind here.
  const kind = mem.read8(SEG_KIND);

  // Kind 4+ is not ours: hand it to the uniform column filler (kinds 4/5/6 select a
  // fill tile; kind >= 7 bails, drawing nothing). This is the oracle's `jp nz,0x0f1b`
  // tail — fillTileColumn advances DE itself, so nothing more to do here.
  if (kind !== 0x03) {
    fillTileColumn(m);
    return;
  }

  // Kind exactly 3: lay the capped vertical run from the record's converted VRAM
  // address. Top cap first, then step one whole tilemap row down.
  let addr = mem.read16(SEG_ADDR1);
  mem.write8(addr, 0xb3);          // TOP cap
  addr = (addr + 0x20) & 0xffff;   // step one tilemap row (map is 0x20 cells wide)

  // Pay the extent down: 0x10 on the first step, 0x08 each body row after. A `sub`
  // borrow — the extent dropped below the step — ends the run on the current row.
  const extent0 = mem.read8(SEG_HEIGHT);
  let extent = (extent0 - 0x10) & 0xff;   // first step spends 0x10 (top cap = 2 tiles)
  let spent = extent0 < 0x10;             // did that first `sub 0x10` borrow?
  for (;;) {
    if (spent) {
      mem.write8(addr, 0xb2);             // BOTTOM cap on the borrowing row
      break;
    }
    mem.write8(SEG_HEIGHT, extent);       // store the decremented extent (observable)
    mem.write8(addr, 0xb1);               // BODY tile
    addr = (addr + 0x20) & 0xffff;        // step one tilemap row
    spent = extent < 0x08;                // next `sub 0x08` borrow test
    extent = (extent - 0x08) & 0xff;      // ...each body row spends 0x08
  }

  // Both the kind-3 exit and the delegated path leave DE one past this record; the
  // walk (sub_0da7) resumes at the next record (the oracle's `jp 0x0DA7` back-edge,
  // here an ordinary JS return).
  regs.de = (regs.de + 1) & 0xffff;
}
