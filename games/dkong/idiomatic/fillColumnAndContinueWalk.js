// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColumnAndContinueWalk — fill a tilemap column from the current cursor, then
 * resume the board-layout walk.  ROM 0x0f35.
 *
 * This is the fill-loop body of the board-layout renderer's kind-4/5/6 arm
 * (fillTileColumn, ROM 0x0F1B), entered with the column cursor HL and the fill
 * tile-code SEG_TILE (0x63B5) ALREADY staged by that arm's setup. It:
 *
 *   - fills the fill tile DOWN the tilemap from the cursor HL: lay the tile, step one
 *     whole tilemap row (+0x20, the map is 0x20 cells wide), and pay the column height
 *     SEG_HEIGHT (0x63B1) down 8 px — one tile — per row; lay at least one tile and keep
 *     going while the height has not run out. SEG_TILE (0x63B5) is loop-invariant (the
 *     loop writes only the tilemap and SEG_HEIGHT), so its read is hoisted out.
 *   - then steps the record pointer DE past this record and resumes the walk (sub_0da7,
 *     the ROM's `inc de` + tail `jp 0x0DA7`), which draws the remaining records and
 *     returns.
 *
 * PURPOSE [guess]: a distinct dispatch entry at 0x0F35 is almost certainly an
 * address-registration artifact, not a real second caller — 0x0F35 is UNREFERENCED
 * (no manifest entry, no `call`/dispatch site anywhere); the ONLY control paths that
 * reach it are fillTileColumn's own fall-through into the loop and its `jp nc,0x0F35`
 * loop-back. The one behavioural difference from fillTileColumn is control-flow, not
 * mechanism: fillTileColumn's back-edge `jp 0x0DA7` is a RETURN (it runs inside the
 * walk, so returning continues it), whereas a hypothetical standalone dispatch of
 * 0x0F35 must DRIVE the remaining walk itself — which the frozen oracle models as a
 * tail `call 0x0DA7`, mirrored here as a direct call to drawBoardLayout.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0f35.test.js.
 * GATE:     crafted-entry — 0x0F35 never dispatches standalone (and its 0x0F1B host is
 *           itself unreached in attract, whose 25m records are all kind 2). States are
 *           captured at the live sibling loc_0e4f, which shares the exact render scratch
 *           (SEG_ADDR1 0x63AB tilemap ptr, SEG_HEIGHT 0x63B1 column extent, DE record
 *           ptr), then the cursor HL and fill tile SEG_TILE (0x63B5) are staged as
 *           fillTileColumn would, on
 *           both sides. The fill is isolated by pointing DE at a 0xAA terminator so the
 *           tail walk returns at once; one case instead points DE at the real 25m table
 *           (0x3AE4) so the tail drives a whole real board draw (the walk drawBoardLayout is
 *           itself gated). Teeth: a wrong column step (fewer rows), a dropped `inc de`
 *           (DE live-out), and a dropped tail walk (the walk's SEG_KIND (0x63B3) write
 *           missing).
 * LIVE-OUT: memory + DE. Memory = SEG_HEIGHT (0x63B1, extent), the tilemap VRAM, plus
 *           whatever the resumed walk draws. DE = the record pointer the walk leaves (a
 *           walk-integrity
 *           cross-check; the walk is internal, so DE is not consumed by a caller). HL/BC
 *           and all flags are dead — the walk reloads them. The direct-call layer models
 *           no stack, so pc/SP carry no residue (the `jp 0x0DA7` becomes the JS call).
 * NAMES:    SEG_TILE (0x63B5, fill tile) and SEG_HEIGHT (0x63B1, column extent) from
 *           ram.js — the board-render segment scratch. The staged cursor's tile address
 *           is SEG_ADDR1 (0x63AB; referenced in prose, not touched here).
 */
import { SEG_TILE, SEG_HEIGHT } from "./ram.js";
import { drawBoardLayout } from "./drawBoardLayout.js"; // ROM 0x0da7 — walk + draw the rest of the layout table

export function fillColumnAndContinueWalk(m) {
  const { regs, mem } = m;

  // Fill the staged tile DOWN the tilemap from the preloaded cursor.
  const tile = mem.read8(SEG_TILE);
  let addr = regs.hl;
  for (;;) {
    mem.write8(addr, tile);            // lay the tile
    addr = (addr + 0x20) & 0xffff;     // step one whole tilemap row
    const height = mem.read8(SEG_HEIGHT);  // remaining column height, in pixels
    mem.write8(SEG_HEIGHT, (height - 0x08) & 0xff);
    if (height < 0x08) break;          // `sub 8` borrowed -> height spent, column done
  }

  // Step the record pointer past this record and resume the layout walk.
  regs.de = (regs.de + 1) & 0xffff;
  drawBoardLayout(m);
}
