// SPDX-License-Identifier: GPL-3.0-only
/**
 * effectStateIdle — the state-0 arm of the effect router: does nothing, reads and writes nothing.
 * LIVE-OUT: none.
 */
export function effectStateIdle(_m) {
  // Deliberately empty; the machine arg is accepted only so the signature matches its router siblings.
}
