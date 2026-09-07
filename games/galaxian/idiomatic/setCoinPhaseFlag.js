// SPDX-License-Identifier: GPL-3.0-only
// Set-to-one arm of a two-state flag toggle: the flag bit was clear, so raise it by
// writing 1 into the cell at the pointer.
// Caller: awardCreditEverySecondCoin (ROM 0x1964) delegates here on the first coin of a two-coins-per-credit
// pair to raise the coin-phase flag (0x4001); on the second coin it clears the flag and awards the credit.

// The "on" value: with only bit 0 meaningful, 1 raises the flag.
const FLAG_ON = 1;

export function setCoinPhaseFlag(m, cell = m.regs.hl) {
  const { mem8 } = m;

  // Turn the flag on.
  mem8[cell] = FLAG_ON;
}
