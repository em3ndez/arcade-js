// SPDX-License-Identifier: GPL-3.0-only
/**
 * bonusExpiredIdle — the idle arm of the bonus-expired sequence: let the frame pass untouched.
 * The step selector holds 0 while the on-screen BONUS has not yet counted down to zero, and 0
 * selects this arm — a total no-op that reads and writes nothing.
 */
export function bonusExpiredIdle(_m) {
  // Deliberately empty; the machine argument is accepted for signature uniformity and unused.
}
