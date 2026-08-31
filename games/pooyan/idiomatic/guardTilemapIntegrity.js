// SPDX-License-Identifier: GPL-3.0-only
import { WAVE_NUMBER, TILE_SUM_ONCE_LATCH, VIDEO_RAM_BASE } from "./names.js";
import { loc_0929 } from "./loc_0929.js";
/**
 * guardTilemapIntegrity — one-shot playfield-tilemap integrity checksum, gated on two RAM flags.
 *
 * WHAT IT IS
 *   An anti-tamper tripwire. Pooyan's ROM is riddled with hidden guards that sum a region of
 *   memory and demand a fixed total; this is the largest of them. It reads the on-screen
 *   playfield tilemap — the plane of tile-code bytes the renderer draws the background from —
 *   as if it were a data table and folds it into a 16-bit accumulator. An intact, un-tampered
 *   tilemap always folds to the same magic total (0x29b8). Any other total means the code or
 *   video image has been altered, and the routine steers the machine into a dead arm.
 *
 * ITS ROLE IN THE MACHINE
 *   This runs on the deep gameplay path, reached once the game has settled into a specific
 *   wave. It is a passive integrity probe layered on top of ordinary play: on a genuine board
 *   it does its arithmetic, matches the magic total, and returns with no visible effect. It
 *   only bites on a doctored ROM, where it turns a subtle image change into a hard crash long
 *   after boot — a style of protection meant to frustrate bootleggers who patch the game and
 *   find it "works" until it mysteriously dies deep into a session.
 *
 * ROM ADDRESS: 0x6ac5 (0x6ac5–0x6b09).
 * Grounding: [seen]
 *
 * GATING
 *   Two RAM flags must both hold or the routine is a no-op:
 *     - WAVE_NUMBER (0x892d) must be exactly 2 — the single wave at which the check is armed.
 *     - TILE_SUM_ONCE_LATCH (0x8f56) must be clear — the run-once latch. The first qualifying
 *       pass sets it to 1 so the sum never runs twice; the board logic clears it again later to
 *       re-arm the guard for the next pass.
 *
 * THE WALK
 *   Starts 0x50 bytes into video RAM (VIDEO_RAM_BASE 0x8400 → 0x8450) and steps a byte at a
 *   time, but the stride is not linear: a cell whose low five bits equal 0x1b is a padding
 *   column and is skipped, and a cell whose low five bits equal 0x1f is a row end, so the low
 *   address byte is bumped by 0x12 to land on the next row's start. When that bump carries past
 *   a page boundary the high byte climbs, and the walk stops once the high byte reaches 0x88,
 *   which is past the end of the tilemap.
 *
 * THE VERDICT
 *   A correct tilemap sums to low byte 0xb8 and high byte 0x29 (0x29b8). A low-byte mismatch
 *   diverts into loc_0929, a genuine screen/attribute-setup routine that itself conceals a
 *   signature trap; a high-byte mismatch is fatal. Both arms are reachable only once work RAM
 *   has been corrupted, so neither fires on a valid tilemap.
 *
 * LIVE-OUT: memory only — the once-flag latch (TILE_SUM_ONCE_LATCH). No register output.
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

  // Gate 1 — arm only on the single wave that carries this check. WAVE_NUMBER (0x892d) is the
  // wave/stage progression index; on every other wave the guard is inert and returns at once.
  if (mem8[WAVE_NUMBER] !== INTEGRITY_WAVE) return;
  // Gate 2 — the one-shot latch. TILE_SUM_ONCE_LATCH (0x8f56) is set on the first qualifying
  // pass and blocks re-entry until the board logic clears it, so the sum runs at most once.
  if (mem8[TILE_SUM_ONCE_LATCH] !== 0) return; // already run this pass
  // Latch the one-shot now, before doing any work, so a re-entry this pass sees it set.
  mem8[TILE_SUM_ONCE_LATCH] = 1; // latch the one-shot

  // Seed the scan cursor at 0x8450 (VIDEO_RAM_BASE 0x8400 + CHECKSUM_START 0x50), split into a
  // high and low address byte so the stride logic below can watch page carries and row wraps
  // exactly the way the hardware address register does. The accumulator starts at zero.
  let hi = (VIDEO_RAM_BASE + CHECKSUM_START) >> 8;
  let lo = (VIDEO_RAM_BASE + CHECKSUM_START) & 0xff;
  let sumHi = 0;
  let sumLo = 0;
  for (;;) {
    // Fold the tile-code byte at the current address into the 16-bit accumulator: add into the
    // low byte, and if that overflows a byte, carry one into the high byte. This is the running
    // total that must land on 0x29b8 for an intact tilemap.
    const s = sumLo + mem8[(hi << 8) | lo];
    sumLo = s & 0xff;
    if (s > 0xff) sumHi = (sumHi + 1) & 0xff; // carry into the high byte

    // Step to the next cell in the row.
    lo = (lo + 1) & 0xff;

    // A cell whose low five bits equal SKIP_COLUMN (0x1b) is a padding column that is not part
    // of the checksummed playfield — step past it without touching the accumulator.
    if ((lo & ROW_MASK) === SKIP_COLUMN) {
      lo = (lo + 1) & 0xff; // skip the excluded column
      continue;
    }

    // Until we reach the row-end marker (low five bits == ROW_MASK 0x1f), just keep summing the
    // next cell — no row-wrap arithmetic is needed mid-row.
    if ((lo & ROW_MASK) !== ROW_MASK) continue;

    // Row end: advance the low address byte by ROW_ADVANCE (0x12) to jump from this row's last
    // cell to the start of the next row. If that addition stays within the page (no byte carry)
    // the walk is still on the same 256-byte page, so continue.
    const t = lo + ROW_ADVANCE;
    lo = t & 0xff;
    if (t <= 0xff) continue; // still on the same page

    // The row advance carried past a page boundary — climb the high address byte. The tilemap
    // ends before page PAGE_LIMIT (0x88); while the high byte is still below it, keep walking,
    // otherwise the scan has run off the end of the tilemap and the loop is done.
    hi = (hi + 1) & 0xff;
    if (hi < PAGE_LIMIT) continue;
    break;
  }

  // Verdict, low half first. An intact tilemap leaves the accumulator low byte at SUM_LOW_OK
  // (0xb8). A miss here diverts into loc_0929 — a real screen/attribute-setup routine that also
  // hides its own signature trap — an arm reachable only when the tilemap has been corrupted.
  if (sumLo !== SUM_LOW_OK) {
    return loc_0929(m); // low-byte mismatch: divert into screen setup (unreachable with a valid tilemap)
  }
  // Verdict, high half. With the low byte right, the high byte must be SUM_HIGH_OK (0x29) to
  // complete the 0x29b8 magic total. On the machine this arm jumps to 0x3829, which holds
  // animation graphics rather than code, so the CPU would begin executing image bytes — an
  // unrecoverable fault raised only after the tilemap has been altered.
  if (sumHi !== SUM_HIGH_OK) {
    throw new Error("guardTilemapIntegrity: tamper checksum mismatch (integrity guard)");
  }
}
