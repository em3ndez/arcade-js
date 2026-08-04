// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e94 — the unconditional caller-skip: make the call return past its caller.
 *
 * Reached only on a path where the routine above it has already decided its caller must NOT
 * run its remaining work. The whole job is that hand-off: instead of the call returning to
 * the routine that reached here, it returns one level further up — to that routine's own
 * caller — abandoning the reached routine's remainder.
 *
 * In the caller-skip convention that decision travels as a boolean the caller consumes as an
 * early return: `if (!loc_1e94(m)) return;`. true = proceed (the caller keeps running),
 * false = skip (the caller returns immediately). This routine has NO condition and NO
 * proceed path — the decision to skip was taken upstream — so it always answers false.
 *
 * A LEAF that reads and writes no work RAM and calls nothing. It maps no input to its
 * output; the answer is the constant "skip".
 *
 * LIVE-OUT: control flow only — the caller-skip boolean, always false. No RAM is written.
 */

export function loc_1e94(m) {
  // Always tell the caller to abandon its remainder. There is no proceed path: the
  // upstream routine only reaches here once it has committed to the skip.
  return false;
}
