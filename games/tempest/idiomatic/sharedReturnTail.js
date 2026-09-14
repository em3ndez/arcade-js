// SPDX-License-Identifier: GPL-3.0-only

/**
 * sharedReturnTail -- no-op leaf: return immediately. ROM 0xaf6e.
 *
 * Role in the machine: the shared RTS tail that drawCounterPair falls through to when both of its
 * counters loc_600/loc_601 are zero -- a jump target that simply returns, letting several code paths
 * share one exit point instead of each carrying its own. It reads and writes nothing.
 *
 * Behavior: takes no action and returns immediately.
 *
 * Live-out: none. Grounding: [seen].
 */
export function sharedReturnTail() {}
