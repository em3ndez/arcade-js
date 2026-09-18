// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e94 — the unconditional caller-skip: make the call return past its caller.
 * Reached only where the routine above has decided its caller must NOT run its remainder. In the
 * caller-skip convention the decision travels as a boolean the caller consumes as an early return
 * (`if (!loc_1e94(m)) return;`): true = proceed, false = skip. This routine has no proceed path,
 * so it always answers false. A leaf that reads and writes nothing.
 */

export function loc_1e94(m) {
  return false;
}
