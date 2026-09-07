// SPDX-License-Identifier: GPL-3.0-only
// Overshoot arm of a compare-and-clamp: the counter ran past its ceiling, so pin the
// cell at the pointer back to exactly the ceiling (99).
// incrementCreditCount (ROM 0x194f) branches here when a coin bumps the credit count past 99, pinning it
// back to the ceiling so the on-screen credit tally never wraps past its two-digit maximum.

// The counter's ceiling value.
const CEILING = 99;

export function clampCreditsToMax(m, cell = m.regs.hl) {
  const { mem8 } = m;

  // Force the overshot counter back down to its ceiling.
  mem8[cell] = CEILING;
}
