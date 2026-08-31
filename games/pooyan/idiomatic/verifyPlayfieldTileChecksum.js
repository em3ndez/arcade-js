// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_CHECKSUM_LATCH, PLAYFIELD_TILE_BASE, TILE_CHECKSUM_TABLE } from "./names.js";
/**
 * verifyPlayfieldTileChecksum — board tile-region tamper checksum, run at most once per arm.
 * ROM 0x3278. [seen]
 *
 * WHAT IT IS. An anti-tamper guard over the playfield's on-screen tile map. It is reached from the
 * per-slot hunter-return tick (tickHunterReturnCounterAndCheckBoardClear) when that path decides the board has settled, and it
 * verifies that the drawn tile region matches one of a small set of layouts the game shipped with.
 * (The routine's own first two program bytes double as the compare value the tamper guard at
 * launchHunterFormationAndSeedSlots reads back, which is why they overlap a header here — a byte the CPU treats as an
 * instruction and as data at once.)
 *
 * WHAT IT DOES. It runs at most once per "arm": TILE_CHECKSUM_LATCH (RAM 0x8f55) is a once-only
 * gate. While the gate is non-zero the check has already run and it returns immediately; on the
 * first pass the gate reads zero, the routine marks it, and then it 16-bit-sums the playfield tile
 * region and looks the total up in a fixed ROM table. The lookup is two stages — first the low
 * byte of the sum against the four table entries, then the high byte against the entries past the
 * low-byte match. A full match means the board is one of the known-good layouts and the routine
 * returns. A low- or high-byte miss cannot arise from an intact tile map, so each was a hard divert
 * in the frozen code (to 0x76d4 and 0x3829 respectively) — modelled here as thrown integrity traps.
 *
 * THE SUM WALK. The tile region is scanned column-major over video-RAM pages. Starting at
 * PLAYFIELD_TILE_BASE (0x8402), it reads consecutive cells within a page while the low-address bits
 * keep filling a 0x1f-wide column window; when the window fills (low bits == 0x1f) it steps the
 * address by three to jump to the next column band, and when THAT step wraps the page's low byte it
 * advances to the next page. Scanning stops once the page reaches END_PAGE (0x88), i.e. past the end
 * of the tile region. Each cell value is added into a 16-bit accumulator with 16-bit wrap.
 *
 * LIVE-OUT: TILE_CHECKSUM_LATCH marked on the first pass; AND — only on a full match — B = the
 * remaining table-scan counter, which the caller resumes into a countdown loop that reads it. B is
 * seated via the return-assignment on the match path.
 */
const END_PAGE = 0x88; // scan stops once the video-RAM page reaches here (past the tile region)

export function verifyPlayfieldTileChecksum(m) {
  const { mem8 } = m;

  // Once-per-arm gate. TILE_CHECKSUM_LATCH (RAM 0x8f55) is non-zero after the check has run for this
  // arm, so a repeat call returns without re-scanning. On the very first pass it reads zero; mark it
  // (increment) so every later call this arm short-circuits above.
  if (mem8[TILE_CHECKSUM_LATCH] !== 0) return; // already scanned this arm
  mem8[TILE_CHECKSUM_LATCH] = mem8[TILE_CHECKSUM_LATCH] + 1;

  // Sum the playfield tile region, column-major over video-RAM pages, into a 16-bit accumulator.
  // Start at PLAYFIELD_TILE_BASE (0x8402): `page` is its high byte, `col` its low byte.
  let page = PLAYFIELD_TILE_BASE >> 8;
  let col = PLAYFIELD_TILE_BASE & 0xff;
  let sum = 0;
  for (;;) {
    // Fold the current cell in with 16-bit wrap (the hardware accumulator's natural overflow).
    sum = u16(sum + mem8[(page << 8) | col]);
    col = (col + 1) & 0xff; // advance to the next cell within this column band
    // Stay in the band until its 0x1f-wide address window is full (low 5 bits all set).
    if ((col & 0x1f) !== 0x1f) continue;
    // Window full: skip three cells to land on the next column band's first cell.
    const skipped = col + 3;
    col = skipped & 0xff;
    // If that step did not carry out of the page's low byte, keep scanning this page.
    if (skipped <= 0xff) continue;
    page = (page + 1) & 0xff; // the column wrapped the page -> advance to the next page
    if (page < END_PAGE) continue; // more tile pages remain
    break; // reached END_PAGE (0x88): whole tile region summed
  }

  // Stage 1: match the sum's LOW byte against the four entries of the ROM checksum table
  // (TILE_CHECKSUM_TABLE, ROM 0x68eb). `remaining` counts entries left to try, starting at 4 and
  // decrementing per miss; on a match, `entry` points at the matching low-byte cell and `remaining`
  // records how many entries were still in play (its later live-out value).
  let entry = TILE_CHECKSUM_TABLE;
  let remaining = 4;
  const sumLow = sum & 0xff;
  for (;;) {
    if (mem8[entry] === sumLow) break;
    entry = u16(entry + 1);
    remaining = remaining - 1;
    if (remaining !== 0) continue;
    // All four low bytes missed: an intact tile map cannot produce this, so it was a hard divert.
    throw new Error("board tile-sum low byte unmatched (data-integrity trap)");
  }

  // Stage 2: confirm the HIGH byte. The table is laid out low/high paired, so the high byte to
  // compare sits at the cell after each low-byte entry; step past the matched low byte, then scan
  // high bytes. A hit here means the whole checksum matches a known-good layout and the routine
  // returns, seating B = `remaining` as the caller's countdown value. Exhausting the entries means
  // the high byte is unmatched — again impossible for intact data, hence an integrity trap.
  const sumHigh = sum >> 8;
  for (;;) {
    entry = u16(entry + 1);
    if (mem8[entry] === sumHigh) return (m.regs.b = remaining); // full match: B live-out = scan counter
    remaining = remaining - 1;
    if (remaining !== 0) continue;
    throw new Error("board tile-sum high byte unmatched (data-integrity trap)");
  }
}
