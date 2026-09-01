// SPDX-License-Identifier: GPL-3.0-only

// Fold C and the record's delta byte into its two running totals; return the second total in A.
export function advanceRecordTotals(m, hl = m.regs.hl, c = m.regs.c) {
  const { mem8 } = m;
  const delta = mem8[hl + 1];
  mem8[hl + 2] = c + mem8[hl + 2];
  const total2 = (delta + mem8[hl + 3]) & 0xff;
  mem8[hl + 3] = total2;
  return (m.regs.a = total2);
}
