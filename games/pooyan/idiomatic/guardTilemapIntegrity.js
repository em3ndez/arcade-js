// SPDX-License-Identifier: GPL-3.0-only
import { WAVE_NUMBER, TILE_SUM_ONCE_LATCH, VIDEO_RAM_BASE } from "./names.js";
import { loc_0929 } from "./loc_0929.js";
/**
 * guardTilemapIntegrity — one-shot playfield-tilemap integrity checksum, gated on two RAM flags.
 *
 * Returns immediately unless the wave index is exactly 2 and the check has not run yet. On the
 * first qualifying pass it latches the once-flag, then sums the tilemap into a 16-bit accumulator:
 * stepping column by column and row by row from a fixed start into video RAM, skipping one column
 * and jumping a fixed span at each row end, until the high address byte leaves the tilemap. A
 * correct tilemap sums to a fixed value; a low-byte mismatch diverts into the screen-setup
 * arm, a high-byte mismatch throws — both reachable only once work RAM has been
 * corrupted, so neither fires on a valid tilemap.
 *
 * LIVE-OUT: memory only — the once-flag latch. No register output (the caller reloads).
 */

const INTEGRITY_WAVE = 0x02; // the wave index that arms the one-shot check
const CHECKSUM_START = 0x50; // offset into video RAM where the tilemap scan begins
const ROW_MASK = 0x1f; //      low bits marking a position within a tilemap row
const SKIP_COLUMN = 0x1b; //   the one column excluded from the checksum
const ROW_ADVANCE = 0x12; //   added to the low address byte to reach the next row
const PAGE_LIMIT = 0x88; //    high address byte at which the scan stops
const SUM_LOW_OK = 0xb8; //    expected accumulator low byte
const SUM_HIGH_OK = 0x29; //   expected accumulator high byte

export function guardTilemapIntegrity(m) {
  const { mem8 } = m;

  if (mem8[WAVE_NUMBER] !== INTEGRITY_WAVE) return;
  if (mem8[TILE_SUM_ONCE_LATCH] !== 0) return; // already run this pass
  mem8[TILE_SUM_ONCE_LATCH] = 1; // latch the one-shot

  let hi = (VIDEO_RAM_BASE + CHECKSUM_START) >> 8;
  let lo = (VIDEO_RAM_BASE + CHECKSUM_START) & 0xff;
  let sumHi = 0;
  let sumLo = 0;
  for (;;) {
    const s = sumLo + mem8[(hi << 8) | lo];
    sumLo = s & 0xff;
    if (s > 0xff) sumHi = (sumHi + 1) & 0xff; // carry into the high byte
    lo = (lo + 1) & 0xff;
    if ((lo & ROW_MASK) === SKIP_COLUMN) {
      lo = (lo + 1) & 0xff; // skip the excluded column
      continue;
    }
    if ((lo & ROW_MASK) !== ROW_MASK) continue;
    const t = lo + ROW_ADVANCE;
    lo = t & 0xff;
    if (t <= 0xff) continue; // still on the same page
    hi = (hi + 1) & 0xff;
    if (hi < PAGE_LIMIT) continue;
    break;
  }

  if (sumLo !== SUM_LOW_OK) {
    return loc_0929(m); // low-byte mismatch: divert into screen setup (unreachable with a valid tilemap)
  }
  if (sumHi !== SUM_HIGH_OK) {
    throw new Error("guardTilemapIntegrity: tamper checksum mismatch (integrity guard)");
  }
}
