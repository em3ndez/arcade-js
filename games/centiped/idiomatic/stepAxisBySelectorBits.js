// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";

/**
 * stepAxisBySelectorBits — pure trackball-axis stepper (ROM 0x39ea). [code]
 *
 * ROLE. A small, memory-free helper that the frame interrupt (serviceFrameIrq)
 * leans on when it samples the trackball. Once per beat the front pulls an
 * axis-selector byte from the hardware input port (IN0+3) and feeds it here twice
 * — once per axis — pre-shifted so the two selector bits for the axis under
 * consideration sit in the top of A. This routine turns those two bits into a
 * one-step nudge of a carried step value (Y) and then shifts A so the NEXT pair of
 * selector bits is ready for the following call. It is the primitive that converts
 * the raw trackball selector encoding into the small signed step the IRQ then
 * folds into its per-axis accumulators.
 *
 * MECHANISM. The top two bits of A form a 3-way selector — think of it as a tiny
 * hardware-defined command: 0x = "creep toward the low clamp window", 10 = "creep
 * toward the high clamp window", 11 = "park at zero". Each non-zero selector moves
 * Y by at most one count per frame and clamps it inside a narrow band, so the step
 * state ramps smoothly instead of jumping — this is what gives the trackball its
 * measured feel rather than snapping between extremes.
 *
 * LIVE-OUT. Returns [steppedY, (A << 2) & 0xff] and mirrors both into m.regs.y and
 * m.regs.a; touches NO memory (the two 6502 registers are the whole footprint).
 */
export function stepAxisBySelectorBits(m, a = m.regs.a, y = m.regs.y) {
  let newY;
  if ((a & 0x80) === 0) {
    // Selector 0x (top bit clear): creep the step DOWN and hold it inside the
    // 0xfa..0xff window — the low, "moving one way" clamp band. Anything already
    // outside the window is snapped to its far edge rather than walked there.
    if (y === 0xfa) newY = 0xfa;          // floor: unchanged
    else if (y > 0xfa) newY = u8(y - 1);  // 0xfb..0xff -> decrement
    else newY = 0xff;                     // below the window -> snap to 0xff
  } else if ((a & 0x40) === 0) {
    // Selector 10 (top bit set, next clear): creep the step UP and hold it inside
    // the mirror window 0x01..0x06 — the high, "moving the other way" clamp band.
    if (y === 0x06) newY = 0x06;          // ceiling: unchanged
    else if (y < 0x06) newY = u8(y + 1);  // 0x00..0x05 -> increment
    else newY = 0x01;                     // above the window -> snap to 0x01
  } else {
    // Selector 11 (both bits set): the "no motion" command — force the step to
    // zero so the axis contributes nothing this frame.
    newY = 0x00;
  }
  // Consume the two selector bits we just used: shift A left twice so the NEXT
  // pair of bits rises into the selector position for the caller's following call,
  // and hand back both the stepped value and the shifted selector byte.
  return [(m.regs.y = newY), (m.regs.a = u8(a << 2))];
}
