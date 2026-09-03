// SPDX-License-Identifier: GPL-3.0-only
/**
 * callFrozenLeaf -- invoke a routine by address for its memory/IO effects only. The clock-free engine
 * fires interrupts at generator yields, not on a cycle count, so m.cycles and m.pcKnown are restored
 * afterward so the callee's own m.step/tick cannot trip a cycle-driven interrupt mid-ISR. SP is left where
 * the callee's `ret` placed it -- safe ONLY for a callee balanced on the stack or not relying on a seated
 * one (the current call sites are no-ops on the exercised path); a load-bearing callee would need care.
 * Optional `hl` seats a base pointer the callee reads.
 */
export function callFrozenLeaf(m, addr, hl = null) {
  const cycles = m.cycles;
  const pcKnown = m.pcKnown;
  if (hl !== null) m.regs.hl = hl;
  m.call(addr);
  m.cycles = cycles;
  m.pcKnown = pcKnown;
}
