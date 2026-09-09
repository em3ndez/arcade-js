// SPDX-License-Identifier: GPL-3.0-only
import { armSlotState } from "./armSlotState.js";

/**
 * enterArmBlockUnlessValueHigh -- compare-first entry to the arm/clear block. ROM 0x2b?? (CMP + fall-in).
 *
 * Role in the machine: a thin entry point used by the special last slot (0x0d) into the shared arm block.
 * On the real board this is a CMP #$0e immediately followed by falling into armSlotState, so the compare's
 * carry becomes the block's bail flag. It exists so "arm this slot, but only if its value is below 0x0e"
 * is reachable as its own labelled entry without duplicating the arm code.
 *
 * Passes carry = (value >= 0x0e) as the bail flag: the block arms only when the value is below 0x0e.
 * X threads through to the slot stamp; the value A is dead into the arm block (the compare already
 * consumed it). Pure delegate -- returns whatever the arm block leaves (carry-CLEAR when it arms,
 * undefined when it bails). Grounding: [code].
 */
export function enterArmBlockUnlessValueHigh(m, a = m.regs.a, x = m.regs.x) {
  // CMP #$0e sets carry when a >= 0x0e; armSlotState bails on carry set and arms on carry clear, so this
  // one line means "arm slot X unless the closeness value has already reached 0x0e".
  // CMP #$0e: carry = (a >= 0x0e); the block bails on carry set, arms on carry clear.
  return armSlotState(m, x, a >= 0x0e);
}
