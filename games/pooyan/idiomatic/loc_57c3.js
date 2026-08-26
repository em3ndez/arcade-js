// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_5835 } from "./loc_5835.js";
import { loc_57c6 } from "./loc_57c6.js";
/**
 * loc_57c3 — the sub-state head: decrement the phase counter and pick a branch.
 *
 * When the counter was 1 (reaches 0) it hands off to the spawn-or-step entry; every other value
 * hands off to the animation-advance stepper. The decremented counter is threaded through the
 * register bridge so a delegate that returns without rewriting it leaves the decremented value behind.
 *
 * SEATING: TAIL-CALL — both exits reuse the caller's frame; the seating is the delegate's.
 * LIVE-OUT: whatever the chosen delegate returns.
 */
export function loc_57c3(m, count = m.regs.b, rec = m.regs.ix) {
  const next = u8(count - 1);
  if (next === 0) return (m.regs.b = 0, loc_5835(m, rec)); // counter reached 0 -> spawn-or-step entry
  return (m.regs.b = next, loc_57c6(m, rec)); //            otherwise -> animation-advance stepper
}
