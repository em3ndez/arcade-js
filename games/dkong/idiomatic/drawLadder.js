// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawLadder — stamp a kind-2 ladder run DOWN the tilemap for a board-layout record.  ROM 0x0E4F.
 *
 * The kind-2 arm of the board-layout drawer chain (sub_0da7 walks a table of
 * segment records; each record's kind byte is stashed at 0x63B3 and dispatched —
 * kind 1 -> drawGirderSpan, kind 2 -> here, kind 3+ -> drawCappedTileColumn).
 * Where the girder fill walks ACROSS laying one tile, this walks DOWN: HL steps a
 * whole tilemap row per row (+0x20, the map is 0x20 cells wide) and the height
 * counter at 0x63B1 is paid down 8 px — one tile — at a time until it borrows.
 *
 * The run is up to two cells wide. On each row it stamps the ladder tile (0x63B5,
 * seeded from the record's tile byte 0x63AF biased by -0x10) and, alongside it, the
 * paired half-tile (tile - 0x10) — skipping that paired write when the cell wrapped
 * off the right edge of a 32-cell row ((L & 0x1F) == 0), or, on the leading row, when
 * the tile is the 0xF0 sentinel.
 *
 * The run can SLANT to track a sloped girder. The x-delta at 0x63B2 selects it:
 *   - 0        -> straight down (redraw the same column every row).
 *   - positive -> slant right: bump the tile code +1 each slant step; when it steps
 *                 past the band (0xF8) wrap the code back to 0xF0 and shift a column right.
 *   - negative -> slant left: drop the tile code -1 each slant step; when it drops
 *                 below the band re-seat it to 0xF7 and shift a column left.
 * When slanting, two rows are laid per slant step (the 16-px band the tile pair spans),
 * so height is paid twice between adjustments. The slant-right path also ends the run
 * early if a shift lands the write pointer on a row boundary; the slant-left path does not
 * (a faithful ROM asymmetry, preserved here — see the two phases below).
 *
 * Anything but kind 2 is handed straight to drawCappedTileColumn (the oracle's
 * `jp nz,0x0EE8`), which draws kind 3 and forwards kind 4+ to the uniform fill;
 * that callee advances DE itself, so this routine adds nothing on that arm.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0e4f.test.js.
 * GATE:     crafted + captured. Attract renders this for real on every 25m ladder
 *           (kind 2), exercising the stamp/descend loop; the kind != 2 delegation and
 *           any slant arm attract does not reach are crafted identically on both sides.
 * LIVE-OUT: memory-only + DE — the record cursor. The successor sub_0da7 (0x0DA7) does
 *           `ld a,(de)` first thing, so the advanced DE must match; A/HL/BC are dead
 *           (the walk and its dispatch overwrite them before any read).
 * NAMES:    none from ram.js — 0x63AB/0x63AF/0x63B1/0x63B2/0x63B3/0x63B5 are the
 *           per-record board-draw scratch, left hex in ram.js (its 0x63xx reject list).
 *           Callee: drawCappedTileColumn (ROM 0x0EE8).
 */

import { drawCappedTileColumn } from "./drawCappedTileColumn.js"; // ROM 0x0EE8

export function drawLadder(m) {
  const { regs, mem } = m;

  // sub_0da7 stashes the record kind here. Only kind 2 is a ladder; hand anything
  // else to the capped-column drawer (it handles kind 3 and forwards kind 4+, and
  // advances DE itself). This is the oracle's `jp nz,0x0EE8`.
  if (mem.read8(0x63b3) !== 0x02) {
    return drawCappedTileColumn(m);
  }

  // Seed the ladder tile code from the record's tile byte, biased by -0x10 (add 0xF0).
  mem.write8(0x63b5, (mem.read8(0x63af) + 0xf0) & 0xff);

  // Walk pointer: the tilemap cell the record's corner fell in (converted VRAM addr).
  let hl = mem.read16(0x63ab);

  // Stamp the ladder tile at HL, then advance HL and stamp the paired half-tile
  // (tile - 0x10) beside it — unless HL wrapped past a 32-cell row boundary, or (only
  // on the leading row) the tile is the 0xF0 sentinel. Re-reads 0x63B5 each call, as
  // the oracle does, so the tile code lives only in memory.
  function stamp(skipOnSentinel) {
    const t = mem.read8(0x63b5);
    mem.write8(hl, t);
    hl = (hl + 1) & 0xffff;
    if ((hl & 0x1f) === 0) return; // ran off the right edge of the row
    if (skipOnSentinel && t === 0xf0) return; // 0xF0 sentinel tile: no pair
    mem.write8(hl, (t - 0x10) & 0xff);
  }

  // Step one full tilemap row down (+0x20 total: the +1 a stamp already did, +0x1F
  // here) and pay 8 px of height. Returns false when the `sub 0x08` borrows — the
  // height is spent and the ladder ends (nothing is stored on the borrowing row).
  function descend() {
    hl = (hl + 0x1f) & 0xffff;
    const h = mem.read8(0x63b1);
    if (h < 0x08) return false;
    mem.write8(0x63b1, (h - 0x08) & 0xff);
    return true;
  }

  // The drawer is a small state machine over the ROM's jump graph; each phase names
  // the block it stands in. Every transfer in the original is a `jp` at flat stack
  // depth, so this is one loop, not recursion.
  let phase = "STAMP_ROW"; // 0x0E62
  for (;;) {
    if (phase === "STAMP_ROW") {
      // 0x0E62 — lay this row's tile pair (skip the pair on a boundary OR the sentinel).
      stamp(true);
      phase = "DESCEND_A";
      continue;
    }

    if (phase === "DESCEND_A") {
      // 0x0E78 — drop a row, pay height. Straight ladders loop back here every row;
      // a nonzero x-delta lays a second row before the slant adjustment.
      if (!descend()) break;
      if (mem.read8(0x63b2) === 0x00) {
        phase = "STAMP_ROW"; // straight down
        continue;
      }
      stamp(false); // slanting: second row, pair skipped only on a row boundary
      phase = "DESCEND_B";
      continue;
    }

    if (phase === "DESCEND_B") {
      // 0x0EA0 — drop the second row, pay height, then adjust the tile code to slant.
      if (!descend()) break;
      if (mem.read8(0x63b2) & 0x80) {
        phase = "SLANT_LEFT"; // x-delta negative
        continue;
      }
      // Slant right: bump the tile code up; a step past the band (0xF8) wraps it back
      // to 0xF0 and shifts the write pointer one column right.
      const t = (mem.read8(0x63b5) + 1) & 0xff;
      mem.write8(0x63b5, t);
      if (t === 0xf8) {
        hl = (hl + 1) & 0xffff;
        mem.write8(0x63b5, 0xf0);
      }
      phase = "ROW_CHECK";
      continue;
    }

    if (phase === "ROW_CHECK") {
      // 0x0EC9 — the slant-right path ends the run if the shift left HL on a row
      // boundary; otherwise draw the next row. (The slant-left path has no such check.)
      if ((hl & 0x1f) !== 0) {
        phase = "STAMP_ROW";
        continue;
      }
      break; // landed on a row boundary -> done
    }

    // SLANT_LEFT — 0x0ED3. Drop the tile code by one; when it falls below the band
    // (`cp 0xF0` sign set: bit 7 of (tile - 0xF0)), re-seat it to 0xF7 and shift a
    // column left. Then loop straight back to the next row (no row-boundary check).
    const t = (mem.read8(0x63b5) - 1) & 0xff;
    mem.write8(0x63b5, t);
    if (((t - 0xf0) & 0x80) !== 0) {
      hl = (hl - 1) & 0xffff;
      mem.write8(0x63b5, 0xf7);
    }
    phase = "STAMP_ROW"; // via 0x0EE5 `jp 0x0E62`
  }

  // 0x0ECF — step the record cursor past this record and return to the walk (0x0DA7).
  regs.de = (regs.de + 1) & 0xffff;
}
