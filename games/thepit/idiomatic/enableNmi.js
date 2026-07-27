// SPDX-License-Identifier: GPL-3.0-only
/**
 * enableNmi — switch on the per-frame vblank interrupt.  ROM 0x4b14.
 *
 * The machine only runs its per-frame service — input sampling, the frame-countdown
 * ticks, the once-a-frame game update — while the vblank interrupt is enabled, and that
 * interrupt is gated by a single control line: the NMI-mask bit of the LS259 control
 * latch. This routine sets that bit, turning the service on. Boot and every round-setup
 * step call it to (re-)arm per-frame service, and the main loop re-arms it on every pass
 * so a stray disable can never leave the game frozen.
 *
 * It is the "on" half of a two-door switch: a sibling entry clears the same bit to turn
 * the interrupt off. Takes nothing and returns nothing — its whole effect is flipping
 * that one control line on, so enabling an already-enabled interrupt is a harmless no-op.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b14.test.js.
 * GATE:     crafted-entry — never dispatched in a plain attract run (its callers aren't
 *           reached and the per-frame NMI handler re-arms the mask with its own direct
 *           write), so the gate clones a real attract state and runs oracle vs idiomatic
 *           with the mask forced clear (the enable is visible, 0->1), forced set
 *           (idempotent), and as-captured; teeth catch a twin that clears the mask and a
 *           twin that leaves it untouched.
 * LIVE-OUT: the NMI-mask control line (LS259 latch bit 0, reached through the 0xb000 I/O
 *           port) left enabled — an I/O side effect, not work RAM, so it sits outside the
 *           RAM dump and the gate compares the latch directly. No register/flag live-out:
 *           every caller overwrites what it leaves behind before reading it.
 * NAMES:    none — 0xb000 is the interrupt-mask I/O port, not work RAM.
 */
export function enableNmi(m) {
  const { mem8 } = m;

  // Set the NMI mask (bit 0 of the LS259 control latch) so the machine accepts the
  // once-per-frame vblank interrupt; until this bit is set that interrupt is ignored and
  // the game gets no per-frame service.
  mem8[0xb000] = 1;
}
