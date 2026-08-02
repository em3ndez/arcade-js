// SPDX-License-Identifier: GPL-3.0-only
/**
 * reportNoHitAndSkipCaller — the "no hit" tail of the sub_2243 hit test: abort the caller as well
 * and unwind two levels, back to the grandparent.  ROM 0x2257.
 *
 * sub_2243 (ROM 0x2243) decides whether the tracked object has reached a hit
 * position. On a HIT it returns normally, so its caller — a dispatch50mObjectState state arm
 * (hold50mObjectParked / slide50mObjectDown) — runs its own tail. On NO HIT it falls into (or jumps to)
 * this tail, which discards the parent's return address and returns past it, so the
 * caller's tail never runs and control resumes two frames up.
 *
 * Modelled directly against the JS call stack: this returns the boolean false, and
 * every routine on the way up propagates it with `if (!callee(m)) return;`. That
 * reproduces the two-level unwind without modelling the Z80 stack at all.
 *
 * A LEAF that is pure control flow: it reads no memory, writes no memory, and calls
 * nothing. Its only output is the skip signal. In the oracle that signal is a drop
 * of the parent's return address into a scratch register followed by a return past
 * it; here it is the boolean.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2257.test.js.
 * GATE:     input-independent — the routine takes the identical action on every
 *           machine state, so crafted entries over a boot/attract base with varied
 *           stack pointers, plus real captured in-play states from the nearest
 *           reachable same-subsystem ancestor (dispatch50mObjectState at ROM 0x2207), all confirm
 *           it writes no RAM and returns false. The 0x2257 dispatch itself is a
 *           gameplay-only hit-test tail (sub_2243/hold50mObjectParked/slide50mObjectDown are never
 *           reached in attract), which is why the realistic states come from 0x2207.
 *           Teeth: a twin that returns true (wrong skip signal) and a twin that
 *           stamps a byte the oracle never writes.
 * LIVE-OUT: the boolean skip signal (false), which drives the caller-skip; memory is
 *           untouched. The oracle's scratch register (the discarded return address)
 *           and its stack unwind are dead — the JS call stack carries the return.
 * NAMES:    none — the routine touches no RAM cells.
 */

/**
 * @param {object} m  the machine (unused: this routine only signals control flow).
 * @returns {boolean} false — "no hit": propagate the skip up the caller chain.
 */
export function reportNoHitAndSkipCaller(m) {
  // No hit: skip the caller too. Returning false makes each caller propagate the
  // skip (return without running its own tail) — the same two-level unwind the
  // oracle performs by dropping the parent's return address and returning past it.
  return false;
}
