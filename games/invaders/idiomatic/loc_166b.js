// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_166b -- the fleet-edge scan's "found" sentinel: set the carry flag and return.
 *
 * WHAT IT IS
 *   A two-instruction ROM tail (`stc; ret`) that reports success by leaving the carry flag set. It is the
 *   target the fleet-edge column scan jumps to the instant it finds a lit alien pixel in the edge column.
 *
 * ROLE IN THE MACHINE
 *   Reached by `jnz 0x166b` from the fleet-edge scan fleetReachedEdge (ROM 0x15c9). Its carry live-out is
 *   read by reverseFleetAtEdge via `rnc` -- carry set means "the fleet has reached this screen edge, reverse
 *   its direction and drop it a row". The name keeps its loc_ form because it is an inline candidate:
 *   fleetReachedEdge already folds this same set-carry directly into its own body, so this standalone copy
 *   carries no role beyond being the shared success sentinel.
 *
 * ROM 0x166b-0x166c.  Grounding: [seen].
 *
 * LIVE-OUT: carry flag = true.
 */
export function loc_166b(m) {
  // stc: raise carry to signal "found", then return to the scan's caller.
  return (m.regs.fC = true);
}
