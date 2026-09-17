// SPDX-License-Identifier: GPL-3.0-only
/** serviceSlotByHeadByte — service one slot, splitting three ways on the head byte of its record. Zero does
 * nothing but leave that zero in A and the zero-test flags standing. All-ones flies the object one
 * step along the velocity it carries, and retires it — into the shared cooldown — only once that
 * step has put it on a retire line. Any OTHER value retires it on the spot, without moving it
 * first, so a slot holding anything else goes out where it stands. Which slot is the caller's; this
 * reads one byte to choose an arm. LIVE-OUT: memory; on the zero arm, A (the head byte) and the
 * flags of testing it against itself; the other two arms leave what the routine they hand off to leaves. */

import { F_H, F_PV, F_Z } from "../../../core/cpu/z80.js";
import { flyAlongStoredVelocity } from "./flyAlongStoredVelocity.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotIntoSharedCooldown } from "./retireSlotIntoSharedCooldown.js";

const ALL_ONES = 255;
// Testing a zero byte against itself: zero result, even parity, half-carry always raised by AND.
const ZERO_TESTED_FLAGS = F_Z | F_H | F_PV;

export function serviceSlotByHeadByte(m, record = m.regs.ix) {
  const head = m.mem8[record];
  if (head === 0) return (m.regs.a = head, m.regs.f = ZERO_TESTED_FLAGS, undefined);
  if (head !== ALL_ONES) {
    retireSlotIntoSharedCooldown(m);
    return;
  }
  flyAlongStoredVelocity(m);
  if (hasReachedRetireLine(m)) retireSlotIntoSharedCooldown(m);
}
