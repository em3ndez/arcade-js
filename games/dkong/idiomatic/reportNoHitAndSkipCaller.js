// SPDX-License-Identifier: GPL-3.0-only
/**
 * reportNoHitAndSkipCaller — the "no hit" tail of the target-column hit test: abort the
 * caller as well and unwind two levels, back to the grandparent.
 *
 * The hit test above decides whether Mario is standing on the target column: it requires his
 * Y below 0x7A, his airborne flag clear, and his X equal to the byte at a caller-supplied
 * pointer. On a HIT it returns normally, so its caller — one of the 50m object-state arms —
 * runs its own tail. On NO HIT it falls into (or jumps to) this tail, which discards the
 * parent's return address and returns past it, so the caller's tail never runs and control
 * resumes two frames up.
 *
 * Modelled directly against the JS call stack: this returns the boolean false, and every
 * routine on the way up propagates it with `if (!callee(m)) return;`. That reproduces the
 * two-level unwind without modelling the machine stack at all.
 *
 * A LEAF that is pure control flow: it reads no memory, writes no memory, and calls nothing.
 * Its only output is the skip signal.
 *
 * LIVE-OUT: the boolean skip signal (false), which drives the caller-skip; memory is
 * untouched.
 */

/**
 * @param {object} m  the machine (unused: this routine only signals control flow).
 * @returns {boolean} false — "no hit": propagate the skip up the caller chain.
 */
export function reportNoHitAndSkipCaller(m) {
  // No hit: skip the caller too. Returning false makes each caller propagate the
  // skip (return without running its own tail) — the same two-level unwind the
  // hardware performs by dropping the parent's return address and returning past it.
  return false;
}
