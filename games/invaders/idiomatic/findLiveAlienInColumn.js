// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

/**
 * findLiveAlienInColumn — find the first still-alive alien down one column of the fleet grid.
 *
 * WHAT IT IS
 *   The alien field is 55 cells laid out as five rows of eleven, one liveness byte per alien, on the
 *   active player's RAM page (see mechanisms.md "The alien field and its march"). Cells in the same
 *   column sit 0x0b (11) bytes apart. This routine walks the five cells of one column and reports the
 *   first nonzero (live) one — used to decide which alien in a firing column drops the next shot.
 *
 * ROLE IN THE MACHINE
 *   Called by the alien-shot stepper (stepAlienShot): once a firing column is chosen, this checks
 *   whether that column still has a live alien to fire from. It forms the active grid base from
 *   ACTIVE_PLAYER_PAGE (0x2067) << 8 (page 0x2100 for player 1, 0x2200 for player 2), then from the
 *   caller's column index (minus one) scans five cells stepping 0x0b each time. On the first live cell
 *   it stops with carry set and L at that cell's low byte, which the caller feeds to
 *   alienIndexToScreenCoords to place the shot; if the whole column is empty, carry falls out of the
 *   final pointer add instead.
 *
 * ROM 0x062f.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT (returned as [fC, C, L], and mirrored into the flags/registers): carry = true on the first
 *   live cell, else the final l+0x0b overflow; C = the input decremented once; L = the found cell's
 *   low byte (or the scan's final low byte when none is live).
 */
export function findLiveAlienInColumn(m, c = m.regs.c) {
  // Select the column base: the caller's index minus one, wrapped to a byte.
  c = (c - 1) & 0xff;
  // Base the scan on the active player's grid page (page byte << 8 gives 0x2100 / 0x2200).
  const page = m.mem8[ACTIVE_PLAYER_PAGE];
  let l = c;
  let carry = false;
  // Walk the five rows of this column: cells in a column are 0x0b (11) apart. Stop at the first live
  // (nonzero) alien with carry set and L at its low byte; otherwise step down the column.
  for (let d = 5; d > 0; d--) {
    if (m.mem8[(page << 8) | l] !== 0) return [m.regs.fC = true, m.regs.c = c, m.regs.l = l];
    const sum = l + 0x0b;
    carry = sum > 0xff;
    l = sum & 0xff;
  }
  // Column exhausted with no live alien: report carry from the last pointer add and the final low byte.
  return [m.regs.fC = carry, m.regs.c = c, m.regs.l = l];
}
