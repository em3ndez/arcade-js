// SPDX-License-Identifier: GPL-3.0-only
/**
 * reportNoHitAndSkipCaller — the "no hit" tail of the target-column hit test: unwind two levels,
 * back to the grandparent, so the caller's own tail never runs.
 *
 * Modelled against the JS call stack: it returns false, and every routine on the way up propagates
 * it with `if (!callee(m)) return;`. That reproduces the two-level unwind — which the hardware does
 * by dropping the parent's return address and returning past it — without modelling the machine
 * stack. A pure control-flow leaf: reads nothing, writes nothing, calls nothing.
 */

export function reportNoHitAndSkipCaller(m) {
  return false;
}
