// SPDX-License-Identifier: GPL-3.0-only
import { armSlotState } from "./armSlotState.js";

/**
 * enterArmBlockUnlessValueHigh -- compare-first entry to the arm/clear block.
 * Passes carry = (value >= 0x0e) as the bail flag: the block arms only when the
 * value is below 0x0e. X threads through to the slot stamp; the value A is dead
 * into the arm block. Pure delegate -- returns whatever the arm block leaves.
 */
export function enterArmBlockUnlessValueHigh(m, a = m.regs.a, x = m.regs.x) {
  // CMP #$0e: carry = (a >= 0x0e); the block bails on carry set, arms on carry clear.
  return armSlotState(m, x, a >= 0x0e);
}
