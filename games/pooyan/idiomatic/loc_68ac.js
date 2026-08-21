// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_CHECKSUM_LATCH, PLAYFIELD_TILE_BASE, TILE_CHECKSUM_TABLE } from "./names.js";
/**
 * loc_68ac — once-only playfield tile-region tamper checksum and dispatch.
 *
 * Runs at most once (guarded by a latch it sets). It sums the playfield tilemap region: for
 * each row it walks a 29-cell-wide column (low byte stepping by 1), skips a 3-cell gap
 * to the next row, and advances pages until the high byte reaches 0x88. The running sum is
 * kept as a low byte and a wrap count. The low byte is looked up in the checksum table; a
 * miss is a tamper condition (an out-of-range branch that is unreachable data, modelled
 * here as a throw). On a hit the wrap count is checked against the table's paired entries;
 * a paired match returns, otherwise it is another tamper throw.
 *
 * LIVE-OUT: memory only — the latch cell (set on the first run). With an intact tilemap the
 * routine returns; a tampered region throws instead of returning.
 */

const TABLE_ENTRIES = 0x04; // checksum table has four candidate entries
const COLUMN_MASK = 0x1f; // column-width mask; end-of-column when low bits == COLUMN_END
const COLUMN_END = 0x1f;
const ROW_GAP = 0x03; // cells skipped between the column end and the next row
const LAST_PAGE = 0x88; // stop once the high byte reaches this page

export function loc_68ac(m) {
  const { mem8 } = m;

  if (mem8[TILE_CHECKSUM_LATCH] !== 0) return; // already ran
  mem8[TILE_CHECKSUM_LATCH] = mem8[TILE_CHECKSUM_LATCH] + 1; // set the latch

  // Sum the tilemap region. `lo`/`carries` are the 16-bit-split running sum (low byte + wrap
  // count); `h`/`l` are the pointer's high/low bytes, stepped as the hardware does (8-bit).
  let h = (PLAYFIELD_TILE_BASE >> 8) & 0xff;
  let l = PLAYFIELD_TILE_BASE & 0xff;
  let lo = 0x00;
  let carries = 0x00;
  for (;;) {
    const sum = lo + mem8[(h << 8) | l];
    lo = sum & 0xff;
    if (sum > 0xff) carries = (carries + 1) & 0xff; // wrap -> bump the carry count
    l = (l + 1) & 0xff;
    if ((l & COLUMN_MASK) !== COLUMN_END) continue; // still inside the column
    const stepped = l + ROW_GAP;
    l = stepped & 0xff;
    if (stepped <= 0xff) continue; // next row, same page
    h = (h + 1) & 0xff;
    if (h < LAST_PAGE) continue; // next page
    break;
  }

  // Match the low-byte sum against the candidate entries.
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

  // On a match, check the wrap count against the paired entries.
  for (;;) {
    ptr = u16(ptr + 1);
    if (carries === mem8[ptr]) return; // paired match -> intact
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    break;
  }
  throw new Error("loc_68ac: tile-region tamper checksum failed (wrap-count no match)");
}
