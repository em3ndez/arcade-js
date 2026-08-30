// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_CHECKSUM_LATCH, PLAYFIELD_TILE_BASE, TILE_CHECKSUM_TABLE } from "./names.js";
/**
 * loc_68ac — once-only playfield tile-region tamper checksum and dispatch, ROM 0x68ac-0x68ea. [seen]
 *
 * Another of Pooyan's self-integrity checks, this one guarding the on-screen playfield
 * tilemap rather than a ROM region. It adds up every tile cell in the playfield area of
 * video RAM and checks that total against a stored list of acceptable answers. An intact
 * board sums to one of the known values and the routine simply returns; a corrupted or
 * bootlegged image sums to something else and the machine is diverted away from normal play.
 *
 * It runs AT MOST ONCE per boot: TILE_CHECKSUM_LATCH (0x8f55) starts at 0, and the first
 * call sets it, so every later call returns immediately without re-summing.
 *
 * The sum walks the tilemap the way the hardware lays it out. Starting at PLAYFIELD_TILE_BASE
 * (0x8402), each row is a 29-cell-wide column: the low address byte steps by 1 through the
 * column, and when the low bits reach the column-end value it skips a 3-cell gap to the next
 * row (a low-byte carry there advances to the next 256-byte page). The scan stops once the
 * high byte reaches page 0x88. Because a single byte cannot hold the total of that many cells,
 * the running sum is split: `lo` is the low byte, and `carries` counts how many times `lo`
 * wrapped past 0xff — together a low-byte-plus-wrap-count signature of the region.
 *
 * That signature is matched against TILE_CHECKSUM_TABLE (0x68eb), a list of expected
 * low-byte / wrap-count PAIRS. First `lo` is looked up among the four candidate entries; a
 * miss is tamper. On a hit, the paired wrap-count entry must also equal `carries`; if it does
 * the region is intact and the routine returns. Either failed match is a tamper condition —
 * in the original it branches to unreachable dispatch data, modelled here as a throw.
 *
 * LIVE-OUT: memory only — TILE_CHECKSUM_LATCH is set on the first run. With an intact tilemap
 * the routine returns; a tampered region throws instead of returning.
 */

const TABLE_ENTRIES = 0x04; // checksum table has four candidate entries
const COLUMN_MASK = 0x1f; // column-width mask; end-of-column when low bits == COLUMN_END
const COLUMN_END = 0x1f;
const ROW_GAP = 0x03; // cells skipped between the column end and the next row
const LAST_PAGE = 0x88; // stop once the high byte reaches this page

export function loc_68ac(m) {
  const { mem8 } = m;

  // Once-only guard: TILE_CHECKSUM_LATCH (0x8f55) is 0 at boot. Bail if it is already set,
  // otherwise set it now so a second call short-circuits and the region is summed just once.
  if (mem8[TILE_CHECKSUM_LATCH] !== 0) return; // already ran
  mem8[TILE_CHECKSUM_LATCH] = mem8[TILE_CHECKSUM_LATCH] + 1; // set the latch

  // Sum the tilemap region. `lo`/`carries` are the 16-bit-split running sum (low byte + wrap
  // count); `h`/`l` are the pointer's high/low bytes, stepped as the hardware does (8-bit).
  let h = (PLAYFIELD_TILE_BASE >> 8) & 0xff;
  let l = PLAYFIELD_TILE_BASE & 0xff;
  let lo = 0x00;
  let carries = 0x00;
  for (;;) {
    // Add this tile cell into the split running sum. When the low byte overflows past 0xff,
    // that overflow is the region's high-order information, so count it in `carries`.
    const sum = lo + mem8[(h << 8) | l];
    lo = sum & 0xff;
    if (sum > 0xff) carries = (carries + 1) & 0xff; // wrap -> bump the carry count
    // Step to the next cell in this row's column.
    l = (l + 1) & 0xff;
    if ((l & COLUMN_MASK) !== COLUMN_END) continue; // still inside the column
    // Column finished: skip the 3-cell inter-row gap to line up on the next row's column.
    const stepped = l + ROW_GAP;
    l = stepped & 0xff;
    if (stepped <= 0xff) continue; // next row, same page
    // The gap carried out of the low byte, so cross into the next 256-byte page; the scan
    // ends once the pointer reaches page 0x88 (just past the playfield tile region).
    h = (h + 1) & 0xff;
    if (h < LAST_PAGE) continue; // next page
    break;
  }

  // Match the low-byte sum against the four candidate entries at the front of
  // TILE_CHECKSUM_TABLE (0x68eb). `ptr` is left pointing at whichever entry matched so the
  // paired wrap-count entry can be read next; no match at all means the region is tampered.
  let ptr = TILE_CHECKSUM_TABLE;
  let remaining = TABLE_ENTRIES;
  let matched = false;
  for (;;) {
    if (lo === mem8[ptr]) { matched = true; break; }
    ptr = u16(ptr + 1);
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    break;
  }
  if (!matched) throw new Error("loc_68ac: tile-region tamper checksum failed (low-byte sum no match)");

  // The low-byte matched; now the wrap count must match its paired table entry too. Both
  // halves agreeing means the tilemap is intact and the routine returns; a wrap-count
  // mismatch is the second tamper outcome.
  for (;;) {
    ptr = u16(ptr + 1);
    if (carries === mem8[ptr]) return; // paired match -> intact
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    break;
  }
  throw new Error("loc_68ac: tile-region tamper checksum failed (wrap-count no match)");
}
