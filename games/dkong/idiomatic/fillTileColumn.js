// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileColumn — fill a tilemap column with a kind-selected tile (board records 4/5/6).  ROM 0x0F1B.
 *
 * The kind-4/5/6 tail of the board-layout renderer. The layout is a table of
 * segment records walked by sub_0da7; each record's kind byte is stashed at
 * 0x63B3 and dispatched (kind 2 -> loc_0e4f ladder, kind 3 -> loc_0ee8 girder
 * cap, kind 4+ -> here). This arm draws a solid vertical run of one tile:
 *
 *   - The kind selects the fill tile-code — 4 -> 0xE0, 5 -> 0xB0, 6 (and any
 *     other kind that reaches the fill) -> 0xFE — stashed at 0x63B5.
 *   - It then fills DOWN the tilemap from the record's converted VRAM address
 *     (0x63AB, the tile the record's corner fell in), laying the tile, stepping
 *     one whole tilemap row per cell (+0x20, the map is 0x20 cells wide), and
 *     paying the column height (0x63B1) down 8 px — one tile — per row. It lays
 *     at least one tile and keeps going while the height has not run out.
 *   - kind >= 7 is a no-op bail: it draws nothing, just advances the record
 *     pointer. `cp 0x07 / jp p` is a SIGN test (bit 7 of kind-7), so kinds 4/5/6
 *     — the only ones routed here — fall through and 7+ bail.
 *
 * Both exits step DE (the record pointer) one byte past this record, and control
 * returns to the walk (sub_0da7) for the next record — the oracle's `jp 0x0DA7`
 * back-edge, which here is an ordinary JS return.
 *
 * A LEAF: calls nothing. Reads the record kind/pointer/extent scratch and DE;
 * writes 0x63B5, 0x63B1, the tilemap, and DE.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0f1b.test.js.
 * GATE:     crafted-entry — entry_0f1b is UNREACHED in attract (its board's 9
 *           records are all kind 2), so states are captured at its live sibling
 *           loc_0e4f, which shares the exact render-scratch (0x63AB tilemap ptr,
 *           0x63B1 extent, 0x63B3 kind, DE record ptr) this routine consumes, and
 *           the kind is nudged to reach every arm (fill 4/5/6, default, kind>=7
 *           bail), identically on both sides. Multi-row fills are exercised.
 * LIVE-OUT: memory + DE. Memory = 0x63B5 (fill tile), 0x63B1 (extent), and the
 *           tilemap VRAM. DE = the record pointer advanced one past this record;
 *           the walk (sub_0da7) reads it as the next record's address. A/HL/BC and
 *           all flags are dead — sub_0da7 reloads them before reading. The oracle
 *           never touches the stack, so pc/SP carry no residue (pc is the dropped
 *           control-flow model — the `jp 0x0DA7` becomes the JS return).
 * NAMES:    none from ram.js — 0x63AB/0x63B1/0x63B3/0x63B5 are board-render scratch
 *           (tilemap ptr / column extent / record kind / fill tile), not named memory.
 */

export function fillTileColumn(m) {
  const { regs, mem } = m;

  // The walk (sub_0da7) stashes the current record's kind here.
  const kind = mem.read8(0x63b3);

  // `cp 0x07 / jp p` is a SIGN test, not an unsigned compare: kinds that leave
  // the subtraction non-negative (7..0x86) bail; kinds 4/5/6 — the only ones
  // routed here — fall through. Bail draws nothing, just steps the record pointer.
  if (((kind - 0x07) & 0x80) === 0) {
    regs.de = (regs.de + 1) & 0xffff;
    return;
  }

  // Kind picks the fill tile-code; 6 (and any other non-4/5 kind) is the default.
  let tile;
  if (kind === 0x04) tile = 0xe0;
  else if (kind === 0x05) tile = 0xb0;
  else tile = 0xfe;

  // Stash the chosen tile, then fill down the column from the record's converted
  // VRAM address (loaded ONCE). 0x63B5 is loop-invariant — the loop only writes
  // the tilemap and 0x63B1, never 0x63B5 — so the oracle's per-row reload of it
  // is hoisted.
  mem.write8(0x63b5, tile);
  let addr = mem.read16(0x63ab);
  for (;;) {
    mem.write8(addr, tile);            // lay the tile
    addr = (addr + 0x20) & 0xffff;     // step one whole tilemap row
    const height = mem.read8(0x63b1);  // remaining column height, in pixels
    mem.write8(0x63b1, (height - 0x08) & 0xff);
    if (height < 0x08) break;          // `sub 8` borrowed -> height spent, column done
  }

  // Step DE one past this record; the walk resumes at the next record.
  regs.de = (regs.de + 1) & 0xffff;
}
