// SPDX-License-Identifier: GPL-3.0-only
/**
 * disableFrameInterrupt — switch the per-frame (vblank) interrupt off.  ROM 0x4b10.
 *
 * The game services itself once per video frame from a vblank interrupt: while it is
 * armed the hardware runs that per-frame handler every frame, and while it is off no
 * per-frame service fires. This routine turns that interrupt off. It is the "off" half
 * of a two-entry pair sharing one control line — its mirror (ROM 0x4b14) arms the same
 * line to switch the interrupt back on. Cold boot calls it first thing, so the machine
 * finishes seeding its state with no interrupt able to run against half-built work RAM.
 *
 * The interrupt is gated by a single line in the addressable control latch (one line
 * per address, each store taking only the low bit of its value), so writing 0 to the
 * interrupt-mask address is what drives that line off. There are no inputs and no
 * choice — it always disables.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b10.test.js.
 * GATE:     real-dispatch — the one cold-boot dispatch (coldBootInit), contract is
 *           work-RAM (nothing stray touched) + the interrupt-mask control line (the
 *           real effect, invisible to a RAM-only diff), plus an interrupt-ENABLED
 *           entry proving it genuinely drives the line off (not a re-read of an
 *           already-off one). Teeth: an arms-the-line twin (the mirror routine's
 *           effect) is caught by the control-line compare.
 * LIVE-OUT: the interrupt-mask control line, driven off. No work RAM is touched and no
 *           register or flag is live out — the caller reloads its accumulator on the
 *           next instruction, so the value the pair leaves is dead.
 * NAMES:    none from ram.js — 0xb000 is the interrupt-mask control-latch address
 *           (I/O, one line per address), not work RAM; kept hex like the other latches.
 */
export function disableFrameInterrupt(m) {
  // Drive the per-frame interrupt line off. Each control-latch address carries one
  // line and takes the low bit of the written value, so storing 0 switches it off.
  m.mem8[0xb000] = 0;
}
