// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyRunUpTileColumn  —  ROM 0x0028  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   One of Frogger's lowest-level tilemap primitives: it stamps a linear run of source bytes UP a single
 *   column of the tile RAM. The Galaxian-derived video hardware stores the background as a 32-wide grid,
 *   so two cells that sit one row apart on screen are 32 addresses apart in memory. Walking the
 *   destination pointer BACKWARD by 32 after each byte therefore climbs the screen one tile at a time —
 *   painting a vertical strip — while the source pointer walks FORWARD through a flat ROM data run. It is
 *   the workhorse behind every column-drawn label, glyph strip, and status-row redraw in the game.
 *
 * WHERE IT SITS
 *   A shared leaf helper with no callees of its own, invoked from a dozen render/blit routines
 *   (serviceVblankNmi's board-advance reveal strip, the score/credit/game-over lines, the mode 2/3/4
 *   attract screens, the initial field paint, …). Each caller loads HL with the top of a VRAM column, DE
 *   with the address of a ROM tile run, and B with the length, then calls in. Because it returns the two
 *   pointers already stepped past the strip it just drew, a caller can chain a second strip immediately
 *   below the first without recomputing addresses.
 *
 * LIVE-OUT
 *   Memory (the tile cells it writes) PLUS both walked pointers. Unlike a memory-only primitive, callers
 *   read the advanced pointers back: this returns them as { hl, de } for migrated callers AND mirrors
 *   them into m.regs.hl / m.regs.de so un-migrated (still-translated) callers see the Z80 register state
 *   the real 0x0028 would have left behind. The equivalence-0028 test's register arm compares both.
 */
import { u16 } from "../../../core/int.js";

// The tile RAM is 32 cells wide, so one on-screen row is 32 addresses. Subtracting it from the
// destination after each byte steps the write position up exactly one tile in the column.
const TILEMAP_ROW = 32;

export function copyRunUpTileColumn(m, dst = m.regs.hl, src = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  // HL = destination (top of the VRAM column), DE = source (a flat ROM tile run), B = byte count.
  let dstPtr = dst;
  let srcPtr = src;

  // Z80 DJNZ loop-count semantics: the count is decremented BEFORE it is tested, so an incoming B of 0
  // first wraps to 0xff and copies a full 256 bytes rather than none. Modelling it as an 8-bit
  // decrement-then-test do/while reproduces that exactly.
  let remaining = count;
  do {
    // Copy one tile byte from the ROM run into the current column cell.
    mem8[dstPtr] = mem8[srcPtr];

    // Advance: destination climbs one row up the column (−32, wrapping at 16 bits like the Z80 pointer),
    // source walks forward one byte through the linear ROM data.
    dstPtr = u16(dstPtr - TILEMAP_ROW);
    srcPtr = u16(srcPtr + 1);

    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);

  // Hand back the pointers positioned just past the strip: mirrored into the registers for translated
  // callers, and returned as { hl, de } for migrated ones.
  return (m.regs.hl = dstPtr, m.regs.de = srcPtr, { hl: dstPtr, de: srcPtr });
}
