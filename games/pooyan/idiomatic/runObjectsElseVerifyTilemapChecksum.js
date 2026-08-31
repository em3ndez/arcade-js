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
 * WHAT IT IS
 *   The main loop calls this once per frame. It carries two mutually exclusive jobs, chosen by the
 *   blink-phase byte:
 *     - Blink phase active: it is the enemy-object driver. It steps every enemy actor riding the
 *       ropes by running the per-object state handler across the whole actor pool, then leaves.
 *     - Blink phase clear, and only on wave 2: it is a one-shot anti-tamper guard. It sums the
 *       playfield's tile-code plane and refuses to continue if the total is wrong.
 *
 * ROLE IN THE MACHINE
 *   The blink phase is the parity of the flashing "watch out" tile pair; while it is set, gameplay
 *   objects are being advanced and there is frame budget to drive them here. When the phase falls
 *   clear the routine's second personality takes over — one of the self-checking integrity traps
 *   this ROM threads through its deep paths. A correctly-drawn playfield always sums to one fixed
 *   value; any other total is only reachable once the tile plane in video RAM has been overwritten,
 *   so a mismatch aborts the frame instead of playing on over a corrupted board.
 *
 *   ROM 0x6a7f-0x6b09.
 *   Grounding: [seen].
 *
 * LIVE-OUT: none (memory only) — the record cursor is local and the caller reads no register back.
 *   The one memory side effect is setting the once-latch so the checksum runs at most once per pass.
 */

// --- Enemy-actor pool geometry (used by the blink-phase object-driver arm) ---
const RECORD_STRIDE = 0x18; // bytes between adjacent actor records in the pool
const RECORD_COUNT = 0x12; // 18 records, the full enemy-actor pool, walked per frame

// --- Tilemap-checksum geometry (used by the integrity-guard arm) ---
// The tile-code plane is a 32-cell-wide grid, so the low 5 bits of an address are the column in a row.
const CHECKSUM_START = 0x50; // offset into video RAM where the tilemap scan begins (0x8400 + 0x50 = 0x8450)
const INTEGRITY_WAVE = 0x02; // the wave index that arms the one-shot check
const ROW_MASK = 0x1f; // low bits marking a position within a tilemap row (the column, 0..0x1f)
const SKIP_COLUMN = 0x1b; // the one column excluded from the checksum (a padding column)
const ROW_ADVANCE = 0x12; // added to the low address byte to reach the next row start
const PAGE_LIMIT = 0x88; // high address byte at which the scan stops (past the tile plane's 0x87ff end)
const SUM_LOW_OK = 0xb8; // expected accumulator low byte  (a valid playfield totals 0x29b8)
const SUM_HIGH_OK = 0x29; // expected accumulator high byte (a valid playfield totals 0x29b8)

export function runObjectsElseVerifyTilemapChecksum(m) {
  // mem8 is the flat byte view of the machine's address space: work RAM plus the two video planes
  // that build the picture (colour attributes from 0x8000, tile codes from VIDEO_RAM_BASE 0x8400).
  const { mem8 } = m;

  // === Arm 1: enemy-object driver (blink phase active) ===
  // BLINK_PHASE (0x892b) is the parity byte the "watch out" tile blink toggles. While it is nonzero,
  // advance every enemy: walk the whole 18-record pool at ENEMY_ACTOR_TABLE (0x8ae0), stride 0x18,
  // handing each record to the per-object state dispatcher, then bail out for the rest of the frame.
  if (mem8[BLINK_PHASE] !== 0) {
    let rec = ENEMY_ACTOR_TABLE;
    for (let i = 0; i < RECORD_COUNT; i++) {
      // dispatchDescendingObjectState routes the record by its (state-1)&3 to the matching behaviour
      // (descend the rope, or re-init the round arena and playfield when it reaches the bottom).
      dispatchDescendingObjectState(m, rec);
      rec = u16(rec + RECORD_STRIDE); // step the cursor to the next record slot in the pool
    }
    return;
  }

  // === Arm 2: one-shot tilemap integrity guard (blink phase clear) ===
  // The guard only fires in one narrow window. WAVE_NUMBER (0x892d) is the stage-progression index;
  // the check is armed only while it reads exactly 2.
  if (mem8[WAVE_NUMBER] !== INTEGRITY_WAVE) return;
  // TILE_SUM_ONCE_LATCH (0x8f56) makes this once-per-pass: a nonzero latch means the sum already ran.
  if (mem8[TILE_SUM_ONCE_LATCH] !== 0) return; // already run this pass
  mem8[TILE_SUM_ONCE_LATCH] = 1; // latch the one-shot so it does not re-run this pass

  // Seed the scan pointer a short way into the tile-code plane (0x8400 + 0x50 = 0x8450) and clear the
  // 16-bit accumulator (sumHi:sumLo). The pointer is held as a split high/low byte pair so the low
  // byte can wrap and steer the strided column-by-column, row-by-row walk of the playfield tiles.
  let hi = (VIDEO_RAM_BASE + CHECKSUM_START) >> 8;
  let lo = (VIDEO_RAM_BASE + CHECKSUM_START) & 0xff;
  let sumHi = 0;
  let sumLo = 0;
  for (;;) {
    // Fold the current tile-code cell into the running 16-bit sum, carrying into the high byte.
    const s = sumLo + mem8[(hi << 8) | lo];
    sumLo = s & 0xff;
    if (s > 0xff) sumHi = (sumHi + 1) & 0xff; // carry into the high byte
    // Advance one cell along the row. The low 5 bits (ROW_MASK) are the column within the 32-wide row.
    lo = (lo + 1) & 0xff;
    if ((lo & ROW_MASK) === SKIP_COLUMN) {
      lo = (lo + 1) & 0xff; // skip the excluded column (0x1b), a padding column left out of the sum
      continue;
    }
    // Still mid-row: keep summing until the pointer reaches the row-end column (0x1f).
    if ((lo & ROW_MASK) !== ROW_MASK) continue;
    // Row end reached: jump the low byte forward by 0x12 to the start of the next row.
    const t = lo + ROW_ADVANCE;
    lo = t & 0xff;
    if (t <= 0xff) continue; // still on the same page
    // The low byte wrapped past 0xff, so move to the next page and stop once past the tile plane.
    hi = (hi + 1) & 0xff;
    if (hi < PAGE_LIMIT) continue;
    break; // high byte reached 0x88, one past the tile-code plane's 0x87ff end -- scan complete
  }

  // A correctly-drawn playfield always totals 0x29b8. A wrong low byte means the tile plane was
  // overwritten, a state unreachable in normal play, so abort rather than run on a corrupted board.
  if (sumLo !== SUM_LOW_OK) {
    throw new Error("runObjectsElseVerifyTilemapChecksum: tilemap integrity checksum low byte mismatch -- unreachable with a valid tilemap, indicates corrupted work RAM");
  }
  // Same guard on the high byte of the total: only a corrupted tile plane can land here.
  if (sumHi !== SUM_HIGH_OK) {
    throw new Error("runObjectsElseVerifyTilemapChecksum: tilemap integrity checksum high byte mismatch -- unreachable with a valid tilemap, indicates corrupted work RAM");
  }
}
