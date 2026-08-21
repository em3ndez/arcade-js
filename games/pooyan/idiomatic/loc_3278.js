// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_CHECKSUM_LATCH, PLAYFIELD_TILE_BASE, TILE_CHECKSUM_TABLE } from "./names.js";
/**
 * Board tile-sum check, run at most once per arm. While the scan gate is non-zero it returns at
 * once; on the first pass (gate zero) it marks the gate, then 16-bit-sums the playfield tile region
 * and looks the sum up in a fixed table — first matching the low byte against the four table
 * entries, then the high byte against the entries beyond the low match. A full match returns; a low-
 * or high-byte miss cannot arise from intact data, so it is a hard data-integrity trap.
 *
 * The sum walks columns by page/column bytes: within a band it reads consecutive cells until the
 * column bits fill (…&0x1f == 0x1f), skips three cells to the next band, and steps a page each time
 * the column wraps, stopping once the page reaches the end page.
 *
 * LIVE-OUT: the scan gate marked on the first pass, AND — on a full match — B = the remaining scan
 * counter (the caller resumes into a djnz that reads it). Set via return-assignment on the match path.
 */
const END_PAGE = 0x88;

export function loc_3278(m) {
  const { mem8 } = m;

  if (mem8[TILE_CHECKSUM_LATCH] !== 0) return; // already scanned this arm
  mem8[TILE_CHECKSUM_LATCH] = mem8[TILE_CHECKSUM_LATCH] + 1;

  let page = PLAYFIELD_TILE_BASE >> 8;
  let col = PLAYFIELD_TILE_BASE & 0xff;
  let sum = 0;
  for (;;) {
    sum = u16(sum + mem8[(page << 8) | col]);
    col = (col + 1) & 0xff; // step the column within the page
    if ((col & 0x1f) !== 0x1f) continue;
    const skipped = col + 3; // jump three cells to the next column band
    col = skipped & 0xff;
    if (skipped <= 0xff) continue;
    page = (page + 1) & 0xff; // column wrapped -> next page
    if (page < END_PAGE) continue;
    break;
  }

  let entry = TILE_CHECKSUM_TABLE;
  let remaining = 4;
  const sumLow = sum & 0xff;
  for (;;) {
    if (mem8[entry] === sumLow) break;
    entry = u16(entry + 1);
    remaining = remaining - 1;
    if (remaining !== 0) continue;
    throw new Error("board tile-sum low byte unmatched (data-integrity trap)");
  }

  const sumHigh = sum >> 8;
  for (;;) {
    entry = u16(entry + 1);
    if (mem8[entry] === sumHigh) return (m.regs.b = remaining); // full match: B live-out = scan counter
    remaining = remaining - 1;
    if (remaining !== 0) continue;
    throw new Error("board tile-sum high byte unmatched (data-integrity trap)");
  }
}
