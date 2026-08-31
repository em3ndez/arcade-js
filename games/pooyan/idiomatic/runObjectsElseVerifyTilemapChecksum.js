// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { dispatchDescendingObjectState } from "./dispatchDescendingObjectState.js";
import {
  BLINK_PHASE,
  WAVE_NUMBER,
  TILE_SUM_ONCE_LATCH,
  VIDEO_RAM_BASE,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
/**
 * runObjectsElseVerifyTilemapChecksum — per-frame object driver with a one-shot tilemap integrity check.
 *
 * While the blink-phase byte is set it walks 18 enemy-actor records (stride 0x18), running the
 * per-object handler for each, then returns. When the blink-phase byte is clear and the wave index
 * is exactly 2, it performs a once-per-pass (latched) checksum of the playfield tilemap: starting a
 * short way into video RAM it sums bytes into a 16-bit accumulator, stepping column by column and
 * row by row while skipping one column, until the high address byte leaves the tilemap. A correct
 * tilemap sums to a fixed value; any other result throws, since the mismatch is only reachable once
 * work RAM has been corrupted.
 *
 * LIVE-OUT: none (memory only) — the record cursor is local and the caller reads no register back.
 */

const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 0x12;
const CHECKSUM_START = 0x50; // offset into video RAM where the tilemap scan begins
const INTEGRITY_WAVE = 0x02; // the wave index that arms the one-shot check
const ROW_MASK = 0x1f; // low bits marking a position within a tilemap row
const SKIP_COLUMN = 0x1b; // the one column excluded from the checksum
const ROW_ADVANCE = 0x12; // added to the low address byte to reach the next row
const PAGE_LIMIT = 0x88; // high address byte at which the scan stops
const SUM_LOW_OK = 0xb8; // expected accumulator low byte
const SUM_HIGH_OK = 0x29; // expected accumulator high byte

export function runObjectsElseVerifyTilemapChecksum(m) {
  const { mem8 } = m;

  if (mem8[BLINK_PHASE] !== 0) {
    let rec = ENEMY_ACTOR_TABLE;
    for (let i = 0; i < RECORD_COUNT; i++) {
      dispatchDescendingObjectState(m, rec);
      rec = u16(rec + RECORD_STRIDE);
    }
    return;
  }

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
    throw new Error("runObjectsElseVerifyTilemapChecksum: tilemap integrity checksum low byte mismatch -- unreachable with a valid tilemap, indicates corrupted work RAM");
  }
  if (sumHi !== SUM_HIGH_OK) {
    throw new Error("runObjectsElseVerifyTilemapChecksum: tilemap integrity checksum high byte mismatch -- unreachable with a valid tilemap, indicates corrupted work RAM");
  }
}
