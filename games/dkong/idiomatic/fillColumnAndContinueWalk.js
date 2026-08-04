// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColumnAndContinueWalk — fill a tilemap column from the current cursor, then resume the
 * board-layout walk.
 *
 * The fill-loop body of the board-layout renderer's column arm, entered with the column cursor
 * and the fill tile code SEG_TILE already staged by that arm's setup. It:
 *
 *   - fills the tile DOWN the tilemap from the cursor: lay the tile, step one whole tilemap
 *     row (the map is 32 cells wide), and pay the column height SEG_HEIGHT down 8 pixels — one
 *     tile — per row; lay at least one tile and keep going while the height has not run out.
 *     SEG_TILE is loop-invariant (the loop writes only the tilemap and SEG_HEIGHT), so its read
 *     is hoisted out.
 *   - then steps the record pointer past this record and resumes the layout walk, which draws
 *     the remaining records and returns.
 *
 * The address this body carries is not a real second entry point [guess]: nothing calls or
 * dispatches it, and the only control paths that reach it are the column arm's own fall-through
 * into the loop and its loop-back. The one behavioural difference from that arm is control
 * flow, not mechanism: inside the arm the walk resumes by RETURNING into it, whereas a
 * standalone entry here has to DRIVE the remaining walk itself, which is why the tail below is
 * a call rather than a return.
 *
 * LIVE-OUT: memory plus the record pointer. Memory = the column extent, the tilemap, and
 * whatever the resumed walk draws. The record pointer is a walk-integrity cross-check rather
 * than something a caller consumes, since the walk is internal.
 */
import { SEG_TILE, SEG_HEIGHT } from "./names.js";
import { drawBoardLayout } from "./drawBoardLayout.js";

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
    if (height < 0x08) break;          // the subtraction borrowed -> height spent, column done
  }

  // Step the record pointer past this record and resume the layout walk.
  regs.de = (regs.de + 1) & 0xffff;
  drawBoardLayout(m);
}
