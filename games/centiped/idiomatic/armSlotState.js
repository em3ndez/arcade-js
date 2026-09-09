// SPDX-License-Identifier: GPL-3.0-only
import { loc_34, loc_42, loc_43, loc_86, loc_87, loc_b2, SFX_TIMER_CH2, SFX_TIMER_CH3, SFX_TIMER_CH4, SFX_TIMER_CH1_PRIORITY, loc_b8 } from "./names.js";

/**
 * armSlotState — arm the fixed timer/flag cells and free object X's slot. ROM 0x2b?? (arm block).
 *
 * Role in the machine: this is the shared "commit a spawn/arm" block that the object-range dispatchers
 * tail into once they have decided a slot is eligible. It stamps the batch of fixed working constants a
 * freshly armed object needs, marks slot X's row as free so a new object can occupy it, and silences the
 * per-object SFX timers so no stale sound leaks into the new object.
 *
 * A caller-gated initializer. When entry carry is CLEAR it stamps a batch of constants (0x30, 0x20,
 * 0x28), retires slot X's row byte (= 0xff), arms one flag to 0x13 unless the sign cell is negative,
 * clears a small block of per-object working flags, and returns carry CLEAR. When entry carry is SET
 * the routine is a no-op: it touches nothing and leaves carry as it found it.
 *
 * The entry carry IS the dispatch decision: the callers pass carry = "out of range / value too high", so
 * a set carry means "do not arm". Live-out (arm path only): $87/$43/$42 constants, $34+x freed, the ch1
 * priority SFX timer, and the $b2/$b3/$b4/$b5/$b8 working-flag block cleared. Grounding: [code].
 */
export function armSlotState(m, x = m.regs.x, carryIn = m.regs.fC) {
  if (carryIn) return; // caller signalled "out of range" -> no writes, carry preserved
  const { mem8 } = m;
  // Stamp the fixed arm-state constants. $87 (0x30), $43 (0x20) and $42 (0x28) are the countdown/phase
  // seeds a newly armed object runs from; the exact values are lifted verbatim from the ROM.
  mem8[loc_87] = 0x30;
  mem8[loc_43] = 0x20;
  mem8[(loc_34 + x) & 0xff] = 0xff; // retire/free slot X's row byte
  mem8[loc_42] = 0x28;
  // Arm the channel-1 priority SFX timer to 0x13 -- but only when the master enable cell $86 is
  // non-negative (bit 7 clear). A negative $86 means path motion is suppressed, so no arm sound is played.
  if ((mem8[loc_86] & 0x80) === 0) mem8[SFX_TIMER_CH1_PRIORITY] = 0x13; // sign cell non-negative -> arm the flag
  // Clear the per-object working-flag block: $b2 plus the three SFX countdown timers feeding POKEY ch2/3/4
  // and $b8, so the new object starts from a clean, silent state with no carried-over effect timers.
  mem8[loc_b2] = 0x00;
  mem8[SFX_TIMER_CH2] = 0x00;
  mem8[SFX_TIMER_CH3] = 0x00;
  mem8[SFX_TIMER_CH4] = 0x00;
  mem8[loc_b8] = 0x00;
  // Return carry CLEAR (6502 CLC) to signal the caller that the arm actually happened.
  return (m.regs.fC = false); // CLC
}
