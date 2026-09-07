// SPDX-License-Identifier: GPL-3.0-only
// flagPlayerShotHitOnFormation — test the player's shot against the standing alien wall in grid space.
//
// WHAT IT IS
//   The collision pass that closes the loop from the player's shot back onto the standing formation.
//   While the shot gate is armed it converts the shot's screen position into a (row, column) grid cell,
//   looks that cell up in the formation flag block, and — only if a live alien occupies it — clears the
//   cell, stamps a hit record, and enqueues two command words so the kill's scoring and sound follow.
//
// ROLE IN THE MACHINE
//   Sibling of flagPlayerShotHitOnObject (0x123f): the object test handles loose divers by box-testing
//   their records, while this one handles the block directly in grid space (see mechanisms.md
//   "Collisions and the hit response" and "The formation flag block"). The formation is a bitmap:
//   FLAG_BITS_BASE (0x4100) is 128 one-byte cells addressed by a packed value whose high nibble is the
//   row and low nibble the column, bit0 marking a live alien. This routine bands the shot Y (loc_4209)
//   into a row by a repeating seven-then-five step down from the top, bands the shot X-delta from the
//   formation anchor (loc_420a - loc_420e) into a column, nibble-swaps the two into the grid index, and
//   on a live cell enqueues one command word carrying the grid index and a second carrying a
//   column-derived scoring code. The hit record (loc_420b / loc_42b1 / loc_42b2 / loc_42b3) is what the
//   scoring and animation code reads to finish the kill.
//
// ROM 0x0b0b.  Grounding: [seen].
//
// LIVE-OUT: on a hit, the flag cell cleared, hit record stamped (loc_420b=1, loc_42b1=1, loc_42b2=0,
// loc_42b3=shot position word) and two command words enqueued; the second enqueue's return is forwarded.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4208, loc_4209, loc_420a, loc_420b, loc_420e,
  loc_42b1, loc_42b2, loc_42b3, FLAG_BITS_BASE,
} from "./names.js";

const GATE_BIT = 0x01;      // shot-armed gate, bit0
const CELL_OCCUPIED = 0x01; // grid-cell bit0: alien present

// Rotate an 8-bit value right four bits (nibble swap). Used to trade a (column-hi, row-lo) value for the
// grid's (row-hi, column-lo) packing and back.
const rotr4 = (v) => ((v >> 4) | (v << 4)) & 0xff;

export function flagPlayerShotHitOnFormation(m) {
  const { mem8, mem16 } = m;

  // The shot must be armed: bit0 of the shot gate loc_4208. No live shot -> nothing to test.
  if ((mem8[loc_4208] & GATE_BIT) === 0) return;

  // Reject shots outside the formation's vertical span: below the top of the wall (>= 104) or, after the
  // -30 shift, above it (negative). loc_4209 is the shot Y.
  const pos = mem8[loc_4209];
  if (pos >= 104) return;
  let y = pos - 30;
  if (y < 0) return;

  // Band Y into a row index. Rows are laid out as a repeating seven-then-five step down from the top: the
  // 7-pixel slice is the gap between rows, the 5-pixel slice is the row's own band. row starts at 6 (top)
  // and counts down; falling into a gap or past the last row is a miss.
  let row = 6;
  for (;;) {
    y -= 7;
    if (y < 0) return;     // fell into the gap between rows
    y -= 5;
    if (y < 0) break;      // settled on this row
    row -= 1;
    if (row === 0) return; // below the last row
  }

  // Column: distance of the shot X (loc_420a) from the formation anchor (loc_420e). Reject unless the low
  // nibble lands in the 11-wide hit window (offset by 2) — i.e. the shot is over a column, not a gap.
  const dx = (mem8[loc_420a] - mem8[loc_420e]) & 0xff;
  if ((((dx & 0x0f) - 2) & 0xff) >= 11) return;

  // Form the grid index: take the column (high nibble of dx) with the row (row+1) in the low nibble, then
  // nibble-swap to the grid's (row-hi, column-lo) packing. Address the flag cell; bail unless it holds a
  // live alien (bit0), otherwise clear it — the alien is now dead.
  const index = rotr4(((dx & 0xf0) + (row + 1)) & 0xff);
  const cell = FLAG_BITS_BASE + index;
  if ((mem8[cell] & CELL_OCCUPIED) === 0) return;
  mem8[cell] = 0;

  // First command word: kind 1 (high byte) carrying the grid index (low byte). The cell address is passed
  // as the saved pointer so enqueueCommandWord leaves HL = cell, matching the Z80 caller convention.
  enqueueCommandWord(m, (1 << 8) | index, cell);

  // Stamp the hit record for the scoring/animation code: retire the shot (loc_420b), mark the record
  // active (loc_42b1), zero its phase (loc_42b2), and store the shot's 16-bit position word (loc_42b3).
  mem8[loc_420b] = 1;
  mem8[loc_42b1] = 1;
  mem8[loc_42b2] = 0;
  mem16[loc_42b3] = mem16[loc_4209];

  // Second command word: kind 3 carrying a column-derived scoring code — 0 for the near columns
  // (index < 80), else the swapped column high bits minus 4. Its return value is forwarded to the caller.
  const code = index < 80 ? 0 : (rotr4(index & 0x70) - 4) & 0xff;
  return enqueueCommandWord(m, (3 << 8) | code, cell);
}
