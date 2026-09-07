// SPDX-License-Identifier: GPL-3.0-only
/**
 * rearmVblankInterruptAndRestoreRegs -- the shared vblank-interrupt epilogue: re-arm the interrupt for
 * the next frame, restore every register the prologue saved, and return through the interrupted address.
 *
 * WHAT IT IS
 *   The vblank interrupt is the machine's whole heartbeat: each frame it saves the registers, does its
 *   per-frame service and state-machine dispatch, and then funnels here to exit. This epilogue undoes
 *   the prologue -- it re-enables the interrupt latch, pops the six saved register pairs back, and
 *   returns to the code the interrupt suspended.
 *
 * ROLE IN THE MACHINE
 *   Every non-boot interrupt dispatch path converges on this routine. IRQ_ENABLE (0x7001) is the
 *   interrupt-enable latch; writing 1 arms the next frame's vblank interrupt (the hardware would
 *   otherwise fire only once). The six pops restore iy/ix/hl/de/bc/af in the reverse of the prologue's
 *   push order, and m.ret() returns through the saved program counter so the interrupted code resumes.
 *
 * ROM 0x00d8.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: all six register pairs (iy/ix/hl/de/bc/af) restored, IRQ_ENABLE armed, and control returned
 *   to the interrupted address via m.ret().
 */
import { IRQ_ENABLE } from "./names.js";

export function rearmVblankInterruptAndRestoreRegs(m) {
  const { mem8 } = m;

  // Re-arm the interrupt-enable latch so the hardware fires the vblank interrupt again next frame.
  mem8[IRQ_ENABLE] = 1; // re-arm the vblank interrupt for the next frame

  // Pop the six register pairs the prologue pushed, in reverse (LIFO) order: iy, ix, hl, then de, bc, af.
  const iy = m.pop16(), ix = m.pop16(), hl = m.pop16();
  const de = m.pop16(), bc = m.pop16(), af = m.pop16();
  // Write the restored pairs back into the register file and return through the saved PC (m.ret),
  // resuming the code the vblank interrupt suspended.
  return (m.regs.iy = iy, m.regs.ix = ix, m.regs.hl = hl, m.regs.de = de, m.regs.bc = bc, m.regs.af = af, m.ret());
}
