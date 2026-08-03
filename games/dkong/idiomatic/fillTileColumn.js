// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileColumn — fill a tilemap column with a kind-selected tile (board records 4/5/6).  ROM 0x0F1B.
 *
 * The kind-4/5/6 tail of the board-layout renderer. The layout is a table of
 * segment records walked by sub_0da7; each record's kind byte is stashed at
 * SEG_KIND (0x63B3) and dispatched (kind 2 -> loc_0e4f ladder, kind 3 -> loc_0ee8
 * girder cap, kind 4+ -> here). This arm draws a solid vertical run of one tile:
 *
 *   - The kind selects the fill tile-code — 4 -> 0xE0, 5 -> 0xB0, 6 (and any
 *     other kind that reaches the fill) -> 0xFE — stashed at SEG_TILE (0x63B5).
 *   - It then fills DOWN the tilemap from the record's converted VRAM address
 *     (SEG_ADDR1, 0x63AB, the tile the record's corner fell in), laying the tile,
 *     stepping one whole tilemap row per cell (+0x20, the map is 0x20 cells wide),
 *     and paying the column height (SEG_HEIGHT, 0x63B1) down 8 px — one tile — per
 *     row. It lays at least one tile and keeps going while the height has not run out.
 *   - kind >= 7 is a no-op bail: it draws nothing, just advances the record
 *     pointer. `cp 0x07 / jp p` is a SIGN test (bit 7 of kind-7), so kinds 4/5/6
 *     — the only ones routed here — fall through and 7+ bail.
 *
 * Both exits step DE (the record pointer) one byte past this record, and control
 * returns to the walk (sub_0da7) for the next record — the oracle's `jp 0x0DA7`
 * back-edge, which here is an ordinary JS return.
 *
 * A LEAF: calls nothing. Reads the record kind/pointer/extent scratch and DE;
 * writes SEG_TILE, SEG_HEIGHT, the tilemap, and DE.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0f1b.test.js.
 * GATE:     crafted-entry — entry_0f1b is UNREACHED in attract (its board's 9
 *           records are all kind 2), so states are captured at its live sibling
 *           loc_0e4f, which shares the exact render-scratch (SEG_ADDR1 tilemap ptr,
 *           SEG_HEIGHT extent, SEG_KIND, DE record ptr) this routine consumes, and
 *           the kind is nudged to reach every arm (fill 4/5/6, default, kind>=7
 *           bail), identically on both sides. Multi-row fills are exercised.
 * LIVE-OUT: memory + DE. Memory = SEG_TILE (fill tile), SEG_HEIGHT (extent), and the
 *           tilemap VRAM. DE = the record pointer advanced one past this record;
 *           the walk (sub_0da7) reads it as the next record's address. A/HL/BC and
 *           all flags are dead — sub_0da7 reloads them before reading. The oracle
 *           never touches the stack, so pc/SP carry no residue (pc is the dropped
 *           control-flow model — the `jp 0x0DA7` becomes the JS return).
 * NAMES:    SEG_ADDR1 (0x63AB tilemap ptr), SEG_HEIGHT (0x63B1 column extent),
 *           SEG_KIND (0x63B3 record kind), SEG_TILE (0x63B5 fill tile) from ram.js —
 *           the line-segment board-render scratch struct.
 */

import { SEG_ADDR1, SEG_HEIGHT, SEG_KIND, SEG_TILE } from "./ram.js";

export function fillTileColumn(m) {
  const { regs, mem } = m;

  // The walk (sub_0da7) stashes the current record's kind here.
  const kind = mem.read8(SEG_KIND);

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
  // VRAM address (loaded ONCE). SEG_TILE is loop-invariant — the loop only writes
  // the tilemap and SEG_HEIGHT, never SEG_TILE — so the oracle's per-row reload of
  // it is hoisted.
  mem.write8(SEG_TILE, tile);
  let addr = mem.read16(SEG_ADDR1);
  for (;;) {
    mem.write8(addr, tile);              // lay the tile
    addr = (addr + 0x20) & 0xffff;       // step one whole tilemap row
    const height = mem.read8(SEG_HEIGHT); // remaining column height, in pixels
    mem.write8(SEG_HEIGHT, (height - 0x08) & 0xff);
    if (height < 0x08) break;            // `sub 8` borrowed -> height spent, column done
  }

  // Step DE one past this record; the walk resumes at the next record.
  regs.de = (regs.de + 1) & 0xffff;
}
