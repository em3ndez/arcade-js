// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawSegmentEndCap — stamp a layout segment's endpoint tiles, then advance the
 * table cursor and re-enter the walk.  ROM 0x0e2a.
 *
 * The board-layout renderer sub_0da7 walks a table of segment records (girders and
 * the like) and, for each, loc_0e19 fills the run with the body tile 0xC0. This
 * routine is the END CAP that runs right after that fill: it stamps the tiles that
 * close the segment at its second (far) endpoint, then steps the table cursor (DE)
 * past the record so the walk continues with the next one.
 *
 * The endpoint write pointer is the second point's tilemap address, held in SEG_ADDR2
 * (0x63AD; its stored value points into video RAM in every real dispatch). Three stamps,
 * guarded:
 *   - ALWAYS: the endpoint body tile = (SEG_SUBTILE2 (0x63B0) span-remainder) + 0xD0, at the ptr.
 *   - IF the record kind SEG_KIND (0x63B3) == 1 (a single-cell segment): the closing tile
 *     0xC0, one cell BACK (ptr's column − 1, wrapping within the tilemap page).
 *   - IF the span-remainder SEG_SUBTILE2 (0x63B0) != 0 (a sub-tile overhang): a partial-cell
 *     tile = remainder + 0xE0, one cell FORWARD (column + 1, page-wrapping).
 * The neighbour cells wrap within the 256-cell page exactly as the ROM's `dec l` /
 * `inc l` do (low byte only), so a segment ending at a page edge stays on its row.
 * SEG_SUBTILE2 is not written between the two reads, so a single read feeds both tiles.
 *
 * Its tail `jp 0x0da7` is the walk-loop re-entry, represented here structurally: the
 * routine returns and its caller (sub_0da7's for(;;)) reads the advanced DE.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0e2a.test.js.
 * GATE:     crafted-entry; all four (kind∈{==1,≠1} × remainder∈{0,≠0}) arms are
 *           REACHED in attract (30 real 0x0e2a dispatches / 4000 frames, all four
 *           combinations present) + crafted entries that force each arm identically
 *           on both sides. Teeth = a wrong endpoint-tile value.
 * LIVE-OUT: memory (VRAM tile cells; no work-RAM writes) + DE, advanced past the
 *           record — the successor 0x0DA7 does `ld a,(de)` first thing. SP is
 *           unchanged (no stack use) and IS compared. A/HL are dead at the tail-jump
 *           (0x0DA7 overwrites A, then H then L) so they are neither reproduced nor
 *           compared; pc is the structural tail-jump target and is not compared
 *           (same treatment as loadSpriteObjectBlock's dropped ret/PC bookkeeping).
 * NAMES:    SEG_SUBTILE2 (0x63B0), SEG_KIND (0x63B3), SEG_ADDR2 (0x63AD) from ram.js —
 *           the playfield line-segment end-cap scratch struct. The stamped tiles land in
 *           VRAM cells (0x70xx-0x77xx) reached through SEG_ADDR2's pointer value, kept hex.
 */

import { SEG_SUBTILE2, SEG_ADDR2, SEG_KIND } from "./ram.js";

export function drawSegmentEndCap(m) {
  const { regs, mem } = m;

  const remainder = mem.read8(SEG_SUBTILE2); // sub-tile span remainder (feeds both tiles)
  const ptr = mem.read16(SEG_ADDR2); // second point's tilemap (VRAM) address
  const page = ptr & 0xff00; // `dec l` / `inc l` wrap within this 256-cell page
  const col = ptr & 0x00ff;

  // ALWAYS: the endpoint body tile.
  mem.write8(ptr, (remainder + 0xd0) & 0xff);

  // Single-cell segment: stamp the closing tile one cell back.
  if (mem.read8(SEG_KIND) === 0x01) {
    mem.write8(page | ((col - 1) & 0xff), 0xc0);
  }

  // Sub-tile overhang: stamp a partial-cell tile one cell forward.
  if (remainder !== 0) {
    mem.write8(page | ((col + 1) & 0xff), (remainder + 0xe0) & 0xff);
  }

  // Advance the table cursor past this record; sub_0da7's walk re-enters at 0x0DA7.
  regs.de = (regs.de + 1) & 0xffff;
}
