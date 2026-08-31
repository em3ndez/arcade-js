// SPDX-License-Identifier: GPL-3.0-only
import { copyDisplayTilesIntoActorRecords } from "./copyDisplayTilesIntoActorRecords.js";
/**
 * seedFourRecordsAndCopyDisplayTiles — the shape-loader prologue.  ROM 0x250f-0x2513.  Grounding: [seen].
 *
 * WHAT IT IS
 *   A tiny two-instruction preamble that seats the geometry of the actor arena and then falls straight
 *   into the shared tile-copier.  Every moving thing on screen -- the player, the enemies, the ropes,
 *   the objects that sail across -- owns one fixed-width record in the arena based at 0x8a80, and each
 *   record carries at offset +0x0f the display byte the video hardware reads to draw that actor.  This
 *   prologue's whole job is to fix two numbers -- how wide one record is, and how many of them to
 *   repaint -- so that a single call restyles a block of four consecutive actors at once.
 *
 * ROLE IN THE MACHINE
 *   This is the "pattern A" shape load: paint exactly four actor records from a 4-byte ROM tile/shape
 *   source table.  The actor state-machine handlers reach for it when a group of actors changes its
 *   on-screen shape in one step -- for example dropLeadActorAfterDelay (0x2473) and
 *   nudgeLeadActorAndAdvanceOnDelay (0x2497) each hand it one of the ROM shape tables
 *   (SHAPE_TABLE_26BD / SHAPE_TABLE_26C1 / SHAPE_TABLE_26C5, all 0x26bd..) as they advance the lead
 *   actor's animation.  The caller supplies only the source table (in HL) and the record pointer (IX);
 *   this prologue supplies the fixed stride and count and then does the painting via the tile-copier.
 *
 * LIVE-OUT (inherited from the tile-copier it falls into)
 *   IX = the record pointer advanced past the whole run (start + 4*0x18); B = 0 (the count has drained).
 *   On the ordinary path HL = the board-clear flag address (0x89e5) and A = 0.  (If the board is being
 *   torn down the copier instead diverts into the board/HUD reset, which sets A/HL/B itself.)
 */

// The fixed geometry of the actor arena, seated here so the shared tile-copier paints the right block.
//   RECORD_STRIDE (0x18) is the width of one actor record -- adding it to the record pointer steps from
//     one actor to the next.  In the machine this is the DE register loaded by `ld de,0x0018` at 0x250f.
//   RECORD_COUNT (0x04) is how many consecutive records this pattern repaints -- the B loop counter set
//     by `ld b,0x04` at 0x2512, which the copier decrements once per record until it wraps to zero.
const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 0x04;

export function seedFourRecordsAndCopyDisplayTiles(m, shapeTable = m.regs.hl, ix = m.regs.ix) {
  // Hand the fixed stride and count to the shared tile-copier and paint four records starting at IX.
  //   shapeTable (HL) is the ROM source row whose successive bytes become the +0x0f display byte of each
  //     of the four records; ix (IX) is the first record to repaint.
  //   The final argument is the low byte of the stride (0x18): in the machine, `ld de,0x0018` also leaves
  //     E = 0x18, and E is carried through as the low byte of the reset display command the copier posts
  //     only if it finds the board being torn down -- so passing RECORD_STRIDE & 0xff reproduces that E.
  return copyDisplayTilesIntoActorRecords(m, shapeTable, RECORD_COUNT, RECORD_STRIDE, ix, RECORD_STRIDE & 0xff);
}
