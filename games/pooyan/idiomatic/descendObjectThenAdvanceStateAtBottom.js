// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { TILE_SUM_ONCE_LATCH } from "./names.js";
/**
 * descendObjectThenAdvanceStateAtBottom — state-1 step of a descending object record (based at IX).
 * Steps the shared animation sequence, then subtracts the speed (IX+9) from the 16-bit position
 * (IX+6):(IX+5) — a borrow out of the low byte decrements the high byte. While the high byte is
 * still non-zero it just returns; once it reaches zero it re-arms the tilemap-sum latch and advances
 * the record's state byte (IX+2).
 * LIVE-OUT: none — memory-only. Reached as a tail dispatch whose ret unwinds to a per-record sweep
 * that reads no result register; all effect is in the record and the latch.
 */

export function descendObjectThenAdvanceStateAtBottom(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);

  // Descend: (IX+6):(IX+5) -= (IX+9); a low-byte borrow decrements the high byte.
  const lo = mem8[rec + 5];
  const speed = mem8[rec + 9];
  mem8[rec + 5] = lo - speed;
  if (lo - speed < 0) mem8[rec + 6] = mem8[rec + 6] - 1;

  if (mem8[rec + 6] !== 0) return; // still above the bottom row

  mem8[TILE_SUM_ONCE_LATCH] = 0x00; // re-arm the tilemap-sum latch
  mem8[rec + 2] = mem8[rec + 2] + 1; // advance to the next state
}
