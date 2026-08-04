// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawSegmentEndCap — stamp a layout segment's endpoint tiles, then advance the
 * table cursor and re-enter the walk.
 *
 * The board-layout renderer walks a table of segment records — girders and the like — and,
 * for each, fills the run with the body tile 0xC0. This routine is the END CAP that runs
 * right after that fill: it stamps the tiles that close the segment at its second (far)
 * endpoint, then steps the table cursor past the record so the walk continues with the next
 * one.
 *
 * The endpoint write pointer is the second point's tilemap address, held in SEG_ADDR2; its
 * stored value points into video RAM on every real dispatch. Three stamps, guarded:
 *   - ALWAYS: the endpoint body tile = the span remainder SEG_SUBTILE2 + 0xD0, at the pointer.
 *   - IF the record kind SEG_KIND == 1 (a single-cell segment): the closing tile 0xC0, one
 *     cell BACK — the pointer's column − 1, wrapping within the tilemap page.
 *   - IF the span remainder is non-zero (a sub-tile overhang): a partial-cell tile =
 *     remainder + 0xE0, one cell FORWARD — column + 1, also page-wrapping.
 * Both neighbour cells wrap within the 256-cell page, because only the LOW byte of the
 * pointer moves, so a segment ending at a page edge stays on its row. SEG_SUBTILE2 is not
 * written between the two reads, so a single read feeds both tiles.
 *
 * The tail is the walk-loop re-entry, represented here structurally: this routine returns
 * and the walk reads the advanced cursor.
 *
 * LIVE-OUT: the stamped video-RAM tile cells — there are no work-RAM writes at all — plus
 * the record cursor, advanced past this record.
 */

import { SEG_SUBTILE2, SEG_ADDR2, SEG_KIND } from "./names.js";

export function drawSegmentEndCap(m) {
  const { regs, mem } = m;

  const remainder = mem.read8(SEG_SUBTILE2); // sub-tile span remainder (feeds both tiles)
  const ptr = mem.read16(SEG_ADDR2); // second point's tilemap address
  const page = ptr & 0xff00; // the neighbour steps wrap within this 256-cell page
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

  // Advance the table cursor past this record; the layout walk picks it up from there.
  regs.de = (regs.de + 1) & 0xffff;
}
