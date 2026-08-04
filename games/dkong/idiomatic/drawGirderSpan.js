// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGirderSpan — stamp a kind-2 slope-band run across the tilemap for a board-layout record.
 *
 * WHAT IT DRAWS IS GIRDER, and that is measured rather than read off the code: blanking the
 * writes made here removes every sloped platform on the board and not one ladder pixel. That
 * is also why the foot-contact check reads the tiles this arm stamps. The short vertical runs
 * — the ladders — are laid by the board-layout walk's other drawer.
 *
 * THE AXIS IS ROTATED, and it is easy to read backwards. Stepping the write pointer by 32
 * walks the RAW TILEMAP ROW axis (index = row*32 + col), which reads as "walks DOWN" only if
 * you forget the rotation. The screen is turned a quarter turn, so the raw row axis is the
 * DISPLAYED HORIZONTAL and the raw column axis is the displayed vertical. On screen this
 * routine therefore lays LONG SLOPED HORIZONTAL runs, measured at 25 cells long and 2 to 4
 * cells thick — exactly a sloped girder.
 *
 * The board-layout walk stashes each segment record's kind byte in SEG_KIND and dispatches
 * on it; kind 2 is this arm. The write pointer steps a whole tilemap row at a time (the map
 * is 32 cells wide) and the height counter SEG_HEIGHT is paid down 8 px — one tile — per row
 * until it borrows.
 *
 * The run is up to two cells wide. On each row it stamps the slope-band tile (SEG_TILE,
 * seeded from the record's tile byte SEG_SUBTILE1 biased by -0x10) and, alongside it, the
 * paired half-tile (tile - 0x10) — skipping that paired write when the cell wrapped off the
 * right edge of a 32-cell row, or, on the leading row, when the tile is the 0xF0 sentinel.
 *
 * The run can SLANT to track a sloped girder. The x-delta SEG_RUN selects it:
 *   - 0        -> straight: redraw the same column every row.
 *   - positive -> slant one way: bump the tile code +1 each slant step; when it steps past
 *                 the band (0xF8) wrap the code back to 0xF0 and shift a column on.
 *   - negative -> slant the other way: drop the tile code -1 each slant step; when it falls
 *                 below the band re-seat it to 0xF7 and shift a column back.
 * When slanting, two rows are laid per slant step (the 16-px band the tile pair spans), so
 * height is paid twice between adjustments. The positive-slant path also ends the run early
 * if a shift lands the write pointer on a row boundary; the negative-slant path does not.
 * That asymmetry is real hardware behaviour and is preserved here.
 *
 * Anything but kind 2 is handed straight to the capped-column drawer, which draws kind 3 and
 * forwards kind 4 and above to the uniform fill; that drawer advances the record cursor
 * itself, so this routine adds nothing on that arm.
 *
 * LIVE-OUT: the stamped tilemap cells, SEG_TILE and SEG_HEIGHT, plus the record cursor,
 * advanced past this record so the walk reads the next one.
 */

import {
  SEG_ADDR1, SEG_SUBTILE1, SEG_HEIGHT, SEG_RUN, SEG_KIND, SEG_TILE,
} from "./names.js";
import { drawCappedTileColumn } from "./drawCappedTileColumn.js";

export function drawGirderSpan(m) {
  const { regs, mem } = m;

  // The layout walk stashes the record kind here. Only kind 2 belongs to this drawer; hand
  // anything else to the capped-column drawer, which handles kind 3, forwards kind 4 and
  // above, and advances the record cursor itself.
  if (mem.read8(SEG_KIND) !== 0x02) {
    return drawCappedTileColumn(m);
  }

  // Seed the slope-band tile code from the record's tile byte, biased by -0x10 (add 0xF0).
  mem.write8(SEG_TILE, (mem.read8(SEG_SUBTILE1) + 0xf0) & 0xff);

  // Walk pointer: the tilemap cell the record's corner fell in.
  let hl = mem.read16(SEG_ADDR1);

  // Stamp the slope-band tile at the pointer, then advance it and stamp the paired
  // half-tile (tile - 0x10) beside it — unless the pointer wrapped past a 32-cell row
  // boundary, or (only on the leading row) the tile is the 0xF0 sentinel. SEG_TILE is
  // re-read on every call, so the live tile code lives only in memory.
  function stamp(skipOnSentinel) {
    const t = mem.read8(SEG_TILE);
    mem.write8(hl, t);
    hl = (hl + 1) & 0xffff;
    if ((hl & 0x1f) === 0) return; // ran off the right edge of the row
    if (skipOnSentinel && t === 0xf0) return; // 0xF0 sentinel tile: no pair
    mem.write8(hl, (t - 0x10) & 0xff);
  }

  // Step one full tilemap row on (32 in total: the +1 a stamp already did, +31 here) and
  // pay 8 px of height. Returns false when that subtraction borrows — the height is spent
  // and the run ends, with nothing stored on the borrowing row.
  function descend() {
    hl = (hl + 0x1f) & 0xffff;
    const h = mem.read8(SEG_HEIGHT);
    if (h < 0x08) return false;
    mem.write8(SEG_HEIGHT, (h - 0x08) & 0xff);
    return true;
  }

  // The drawer is a small state machine; each phase names the block it stands in. Every
  // transfer between them happens at flat stack depth, so this is one loop, not recursion.
  let phase = "STAMP_ROW";
  for (;;) {
    if (phase === "STAMP_ROW") {
      // Lay this row's tile pair (skip the pair on a boundary OR the sentinel).
      stamp(true);
      phase = "DESCEND_A";
      continue;
    }

    if (phase === "DESCEND_A") {
      // Step a row, pay height. Straight (unslanted) runs loop back here every row;
      // a nonzero x-delta lays a second row before the slant adjustment.
      if (!descend()) break;
      if (mem.read8(SEG_RUN) === 0x00) {
        phase = "STAMP_ROW"; // straight run, no slant
        continue;
      }
      stamp(false); // slanting: second row, pair skipped only on a row boundary
      phase = "DESCEND_B";
      continue;
    }

    if (phase === "DESCEND_B") {
      // Step the second row, pay height, then adjust the tile code to slant.
      if (!descend()) break;
      if (mem.read8(SEG_RUN) & 0x80) {
        phase = "SLANT_LEFT"; // x-delta negative
        continue;
      }
      // Positive slant: bump the tile code up; a step past the band (0xF8) wraps it back
      // to 0xF0 and shifts the write pointer one column on.
      const t = (mem.read8(SEG_TILE) + 1) & 0xff;
      mem.write8(SEG_TILE, t);
      if (t === 0xf8) {
        hl = (hl + 1) & 0xffff;
        mem.write8(SEG_TILE, 0xf0);
      }
      phase = "ROW_CHECK";
      continue;
    }

    if (phase === "ROW_CHECK") {
      // The positive-slant path ends the run if the shift left the pointer on a row
      // boundary; otherwise draw the next row. The negative-slant path has no such check.
      if ((hl & 0x1f) !== 0) {
        phase = "STAMP_ROW";
        continue;
      }
      break; // landed on a row boundary -> done
    }

    // SLANT_LEFT. Drop the tile code by one; when it falls below the band (bit 7 of
    // tile - 0xF0 set), re-seat it to 0xF7 and shift a column back. Then loop straight
    // on to the next row, with no row-boundary check.
    const t = (mem.read8(SEG_TILE) - 1) & 0xff;
    mem.write8(SEG_TILE, t);
    if (((t - 0xf0) & 0x80) !== 0) {
      hl = (hl - 1) & 0xffff;
      mem.write8(SEG_TILE, 0xf7);
    }
    phase = "STAMP_ROW";
  }

  // Step the record cursor past this record and return to the layout walk.
  regs.de = (regs.de + 1) & 0xffff;
}
