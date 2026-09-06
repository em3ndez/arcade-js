// SPDX-License-Identifier: GPL-3.0-only
// Per-slot step of the secondary-object spawn walk: spawn into the current slot, advance the slot pointer to
// the next record, and count the budget down. While budget remains, return; when it reaches zero force the
// caller's loop counter to 1 so the caller's walk ends after this pass.
import { u8, u16 } from "../../../core/int.js";
import { spawnSecondaryObjectIntoSlot } from "./spawnSecondaryObjectIntoSlot.js";

const SLOT_STRIDE = 32; // bytes between consecutive secondary slots

export function loc_148e(m, slot = m.regs.iy, budget = m.regs.c) {
  spawnSecondaryObjectIntoSlot(m, slot);

  const nextSlot = u16(slot + SLOT_STRIDE);
  const nextBudget = u8(budget - 1);

  if (nextBudget !== 0) return (m.regs.iy = nextSlot, m.regs.c = nextBudget);
  return (m.regs.iy = nextSlot, m.regs.c = nextBudget, m.regs.b = 1);
}
