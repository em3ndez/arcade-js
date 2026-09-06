// SPDX-License-Identifier: GPL-3.0-only
// Vblank interrupt epilogue: re-arm the interrupt-enable latch so the next frame's interrupt
// fires, restore the six saved register pairs, and return through the interrupted address.
import { IRQ_ENABLE } from "./names.js";

export function rearmVblankInterruptAndRestoreRegs(m) {
  const { mem8 } = m;

  mem8[IRQ_ENABLE] = 1; // re-arm the vblank interrupt for the next frame

  // Restore the saved pairs (popped in the prologue's push order), then return through the saved PC.
  const iy = m.pop16(), ix = m.pop16(), hl = m.pop16();
  const de = m.pop16(), bc = m.pop16(), af = m.pop16();
  return (m.regs.iy = iy, m.regs.ix = ix, m.regs.hl = hl, m.regs.de = de, m.regs.bc = bc, m.regs.af = af, m.ret());
}
