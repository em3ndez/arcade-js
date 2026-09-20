// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawSegmentEndCap — stamp a layout segment's far-endpoint tiles at SEG_ADDR2, then advance the
 * table cursor. Always the body tile (remainder + 0xD0); for a single-cell segment (SEG_KIND == 1)
 * the closing tile 0xC0 one cell back; for a sub-tile overhang (remainder non-zero) a partial tile
 * (remainder + 0xE0) one cell forward. Neighbour steps wrap within the 256-cell page because only
 * the pointer's low byte moves.
 *
 * LIVE-OUT: the stamped video-RAM tile cells plus the record cursor, advanced past this record.
 */

import { u16 } from "../../../core/int.js";
import { SEG_SUBTILE2, SEG_ADDR2, SEG_KIND } from "./names.js";

export function drawSegmentEndCap(m, de = m.regs.de) {
  const { mem8, mem16 } = m;

  const remainder = mem8[SEG_SUBTILE2];
  const ptr = mem16[SEG_ADDR2];
  const page = ptr & 0xff00; // neighbour steps wrap within this page
  const col = ptr & 0xff;

  mem8[ptr] = (remainder + 0xd0);

  if (mem8[SEG_KIND] === 0x01) {
    mem8[page | ((col - 1) & 0xff)] = 0xc0;
  }

  if (remainder !== 0) {
    mem8[page | ((col + 1) & 0xff)] = (remainder + 0xe0);
  }

  return (m.regs.de = u16(de + 1));
}
