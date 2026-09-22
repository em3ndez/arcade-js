// SPDX-License-Identifier: GPL-3.0-only
/**
 * allSlotsClear — does a strided table of ten object slots (base, stride; count fixed at ten)
 * read all-zero? Short-circuits false at the first non-zero cell.
 *
 * LIVE-OUT: the verdict only — true = all clear, false = a slot is occupied. Writes no memory.
 */
import { u16 } from "../../../core/int.js";

export function allSlotsClear(mem8, base, stride) {
  let addr = u16(base);
  for (let slot = 0; slot < 10; slot++) {
    if (mem8[addr] !== 0) return false;
    addr = u16(addr + stride); // 16-bit wrap
  }
  return true;
}

/**
 * allSlotsClearFromRegisters — the fn(m) seam entry (base/stride in HL/DE); returns the caller-skip
 * boolean. DEAD-WIRED: the live board-advance arm bypasses it (calls the pure allSlotsClear direct),
 * so it is never dispatched and its exit flags are never observed. The all-clear arm keeps A/HL/B as
 * the isolated-seam data contract; F is dropped as dead. Writes no memory.
 */
export function allSlotsClearFromRegisters(m, base = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;

  if (!allSlotsClear(mem8, base, stride)) return false; // caller-skip; residuals dropped

  return (m.regs.a = 0x00, m.regs.hl = u16(base + 10 * stride), m.regs.b = 0x00, true);
}
