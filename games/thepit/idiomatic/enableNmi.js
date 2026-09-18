// SPDX-License-Identifier: GPL-3.0-only
/**
 * enableNmi — switch on the per-frame vblank interrupt. The machine runs its per-frame
 * service (input sampling, frame-countdown ticks, the once-a-frame update) only while the
 * vblank interrupt is enabled, gated by the NMI-mask bit of the control latch. This sets
 * that bit; a sibling entry clears the same bit to switch the interrupt back off.
 */
export function enableNmi(m) {
  const { mem8 } = m;

  // Set the NMI mask (bit 0 of the LS259 control latch) so the machine accepts the
  // once-per-frame vblank interrupt; until this bit is set that interrupt is ignored and
  // the game gets no per-frame service.
  mem8[0xb000] = 1;
}
