// SPDX-License-Identifier: GPL-3.0-only
/** serviceSlotByHeadByte — service one slot, splitting three ways on the head byte of its record. Zero does
 * nothing at all. All-ones flies the object one step along the velocity it carries, and retires it
 * — into the shared cooldown — only once that step has put it on a retire line. Any OTHER value
 * retires it on the spot, without moving it first, so a slot holding anything else goes out
 * where it stands. Which slot is the caller's; this reads one byte to choose an arm and writes
 * nothing itself. LIVE-OUT: memory. */

import { flyAlongStoredVelocity } from "./flyAlongStoredVelocity.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotIntoSharedCooldown } from "./retireSlotIntoSharedCooldown.js";

const ALL_ONES = 255;

export function serviceSlotByHeadByte(m) {
  const head = m.mem8[m.regs.ix];
  if (head === 0) return;
  if (head !== ALL_ONES) {
    retireSlotIntoSharedCooldown(m);
    return;
  }
  flyAlongStoredVelocity(m);
  if (hasReachedRetireLine(m)) retireSlotIntoSharedCooldown(m);
}
