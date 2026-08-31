// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import { fillByteRun } from "./fillByteRun.js";
import { TILE_FILL_PTR, FILL_ROW_COUNTER } from "./names.js";
/**
 * clearBoardRamAndBlankFillRow — clear the board-init RAM, then blank one tilemap row
 *                                and step the row counter.  (ROM 0x02c9, grounding: [seen])
 *
 * WHAT IT IS
 *   One tick of the machine's "wipe the playfield" work.  The screen is a 32x32 grid of
 *   cells; the tile-code plane that decides each cell's shape lives in video RAM (0x8400-
 *   0x87FF).  Blanking the whole plane in one shot would be too much to do inside a single
 *   frame, so the program spreads it out: it erases exactly one row of cells per call and
 *   remembers, in two RAM cells, how far it has got.
 *
 * ROLE IN THE MACHINE
 *   This is the per-frame step of the row-by-row tilemap fill used when a board is being
 *   (re)built — round setup and the between-rounds screen clear.  The board-setup handlers
 *   arm the fill (seed the cursor and a row count), then call this once each frame and bail
 *   out until it reports the fill has drained; only then do they flood the colour plane and
 *   seed the actors.  The net effect is that a fresh playfield paints in over successive
 *   frames instead of in one visible burst.  Two RAM cells carry the progress between calls:
 *     • TILE_FILL_PTR    (0x880b) — 16-bit write cursor into the tile-code plane
 *     • FILL_ROW_COUNTER (0x8809) — down-counter of rows still to erase
 *
 * LIVE-OUT
 *   The Z flag = "the row counter just reached zero" (the whole fill has drained).  Every
 *   caller returns-if-not-zero immediately after this, so Z is the only result consumed;
 *   the erased row and the two advanced RAM cells are side effects left in memory.
 */

const TILE_BLANK = 0x10; // the blank/erase tile code written into every cleared cell
const ROW_WIDTH = 0x20; // full tilemap row pitch: 32 cells from one row's start to the next
const VISIBLE_TILES = 0x1d; // cells actually blanked per row (29); the last 3 are the off-screen row remainder

export function clearBoardRamAndBlankFillRow(m) {
  // Step 1 — clear the board-init RAM regions (ROM 0x02b9).
  // Before touching the tilemap, wipe the two work-RAM areas a fresh board depends on:
  // the sprite display list and the actor/object arena.  This runs on every call (it is
  // cheap and idempotent), so the sprite/actor state stays zeroed for the whole fill.
  zeroSpriteListAndActorArena(m); // zero the sprite/actor RAM regions
  const { mem8, mem16 } = m;
  // Step 2 — blank the visible cells of the current row (ROM 0x02d7-0x02da).
  // Read the 16-bit write cursor from TILE_FILL_PTR (0x880b), then paint VISIBLE_TILES
  // (0x1d = 29) copies of the blank tile 0x10 starting there, walking the cursor forward
  // as it writes.  Only the on-screen 29 cells are touched; the returned value is the
  // cursor left sitting just past the last blanked cell.
  const afterFill = fillByteRun(m, mem16[TILE_FILL_PTR], TILE_BLANK, VISIBLE_TILES);
  // Step 3 — advance the cursor across the row remainder to the next row's start (ROM 0x02db-0x02de).
  // The fill covered 0x1d cells; adding the leftover ROW_WIDTH-VISIBLE_TILES (0x20-0x1d = 3)
  // skips the 3 off-screen cells so the cursor lands on the same column of the row below —
  // a full 0x20-cell row pitch in total.  Store it back into TILE_FILL_PTR for next frame.
  mem16[TILE_FILL_PTR] = u16(afterFill + (ROW_WIDTH - VISIBLE_TILES));
  // Step 4 — count this row off (ROM 0x02e1-0x02e2, dec (0x8809)).
  // Decrement FILL_ROW_COUNTER (0x8809), the number of rows still to erase, keeping it a
  // byte (& 0xff so a 0 count wraps to 0xff exactly as an 8-bit dec would).
  const remaining = (mem8[FILL_ROW_COUNTER] - 1) & 0xff;
  mem8[FILL_ROW_COUNTER] = remaining;
  // Step 5 — publish the drained/not-drained verdict as the Z flag.
  // Z is set once the counter hits zero, i.e. the last row has been blanked.  Callers loop
  // one row per frame and return-if-not-zero, so setting Z here is what lets the fill end.
  return (m.regs.fZ = remaining === 0); // Z live-out: callers return-if-not-zero until the fill drains
}
