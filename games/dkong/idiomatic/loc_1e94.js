// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e94 — unconditional caller-skip: make the call return past its caller.  ROM 0x1E94.
 *
 * Reached only on the path where the routine above it (0x1E8C) has already decided its
 * caller must NOT run its remaining work. Its whole job is that hand-off: instead of the
 * call returning to the routine that reached here, it returns one level further up — to
 * that routine's own caller — abandoning the reached routine's remainder.
 *
 * In the caller-skip convention shared with the guards (gameActiveGuard, marioActiveGuard),
 * that decision is expressed as a boolean the caller consumes as an early return:
 * `if (!loc_1e94(m)) return;`. true = proceed (the caller keeps running), false = skip
 * (the caller returns immediately). This routine has NO condition and NO proceed path — the
 * decision to skip was already taken upstream — so it always answers false: always skip.
 *
 * A LEAF that reads and writes no work RAM and calls nothing. It maps no input to its
 * output; the answer is the constant "skip".
 *
 * NAME: kept the neutral loc_ — the mechanism (an unconditional caller-skip) is pinned to
 * the oracle, but which game event upstream decided to skip (and what its gate cell 0x6350
 * means) is not confirmed to the routine-name bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e94.test.js.
 * GATE:     crafted entries — the routine is input-invariant (always skips), so crafted
 *           stacks vary the caller-caller return target and the stack pointer and prove
 *           pc + SP line up with the oracle over RAM − STACK_SCRATCH. Currently unreachable
 *           in attract (its caller's 0x1E96 arm is still untranslated), so there are no real
 *           captured dispatches; the reachability probe confirms 0 and validates any that
 *           later occur. Teeth: a twin that proceeds instead of skipping (wrong pc + SP),
 *           and a twin that scribbles work RAM (RAM diff).
 * LIVE-OUT: control flow only — the caller-skip boolean (always false). It writes no RAM,
 *           and the residual registers/flags the oracle leaves are dead ABI (the two-level
 *           return becomes ordinary JS control flow once the caller consumes the boolean).
 * NAMES:    none — touches no named work-RAM cell. It only reads the return stack, which is
 *           dead STACK_SCRATCH and unnamed by design.
 */

export function loc_1e94(m) {
  // Always tell the caller to abandon its remainder. There is no proceed path: the
  // upstream routine only reaches here once it has committed to the skip.
  return false;
}
