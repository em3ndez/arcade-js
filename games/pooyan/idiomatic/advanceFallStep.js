// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFallStep — advance a falling actor one gravity step; report if still airborne.
 *
 * Vertical position is 16-bit fixed point: fraction at rec+0x03, integer row at rec+0x04.
 * Adds the fall velocity (rec+0x09) into the fraction; an 8-bit overflow carries one row.
 *
 * LIVE-OUT: boolean (true = above the landing row, keep falling), plus the updated
 * fraction and, on overflow, the incremented integer row.
 */

const LANDING_ROW = 0x1e;

export function advanceFallStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Add fall velocity into the fraction; an 8-bit overflow carries one whole row.
  const sum = mem8[rec + 0x03] + mem8[rec + 0x09];
  if (sum > 0xff) {
    mem8[rec + 0x04] = mem8[rec + 0x04] + 1;
  }
  mem8[rec + 0x03] = sum;

  return mem8[rec + 0x04] < LANDING_ROW;
}
