// SPDX-License-Identifier: GPL-3.0-only
/**
 * bonusExpiredIdle — the idle arm of the bonus-expired sequence: let the frame pass untouched.
 *
 * The sequence's step selector holds 0 for as long as the on-screen BONUS has not yet counted down
 * to zero, and 0 selects this arm. It takes no inputs, reads and writes no memory, and returns —
 * so on those frames the sequence stays dormant and nothing on screen or in memory changes.
 *
 * Branchless and total: the same no-op for every machine state it can be entered with.
 *
 * LIVE-OUT: nothing. No memory is written and no value is handed back.
 */
export function bonusExpiredIdle(_m) {
  // Deliberately empty. The machine argument is accepted for signature uniformity and unused.
}
