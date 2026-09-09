// SPDX-License-Identifier: GPL-3.0-only
import { loc_34, loc_42, loc_43, loc_86, loc_87, loc_b2, SFX_TIMER_CH2, SFX_TIMER_CH3, SFX_TIMER_CH4, SFX_TIMER_CH1_PRIORITY, loc_b8 } from "./names.js";

/**
 * armSlotState — arm the fixed timer/flag cells and free object X's slot.
 *
 * A caller-gated initializer. When entry carry is CLEAR it stamps a batch of constants (0x30, 0x20,
 * 0x28), retires slot X's row byte (= 0xff), arms one flag to 0x13 unless the sign cell is negative,
 * clears a small block of per-object working flags, and returns carry CLEAR. When entry carry is SET
 * the routine is a no-op: it touches nothing and leaves carry as it found it.
 */
export function armSlotState(m, x = m.regs.x, carryIn = m.regs.fC) {
  if (carryIn) return; // caller signalled "out of range" -> no writes, carry preserved
  const { mem8 } = m;
  mem8[loc_87] = 0x30;
  mem8[loc_43] = 0x20;
  mem8[(loc_34 + x) & 0xff] = 0xff; // retire/free slot X's row byte
  mem8[loc_42] = 0x28;
  if ((mem8[loc_86] & 0x80) === 0) mem8[SFX_TIMER_CH1_PRIORITY] = 0x13; // sign cell non-negative -> arm the flag
  mem8[loc_b2] = 0x00;
  mem8[SFX_TIMER_CH2] = 0x00;
  mem8[SFX_TIMER_CH3] = 0x00;
  mem8[SFX_TIMER_CH4] = 0x00;
  mem8[loc_b8] = 0x00;
  return (m.regs.fC = false); // CLC
}
