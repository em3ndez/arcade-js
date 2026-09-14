// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";

/**
 * advanceDisplayCursor — step the 16-bit display cursor forward by Y+1. ROM 0xdf5f (display-cursor advance).
 *
 * Role in the machine: Tempest is a colour vector game — the 6502 assembles a display list in the AVG's
 * vector RAM at $2000-$2fff, and DRAW_CURSOR_LO/DRAW_CURSOR_HI ($74/$75) is the write head that lays those
 * vector words down. This routine is the hinge every emitter turns on: after a primitive writes its bytes
 * through the cursor origin it calls here to move the head past what it just wrote, so the next record lands
 * immediately after. Under load the cursor sweeps continuously across the whole $2000-$2fff display RAM.
 *
 * Behavior: it adds the stride Y plus one to the low byte at $74 — the extra +1 is the 6502's carry, which
 * the caller forces set, giving DRAW_CURSOR_LO + Y + 1. The result is stored back into $74; when it overflows
 * past 0xff the high byte $75 is bumped by one to carry into the next page. There are no loops and no other
 * cells: a single add, a store, and a conditional page carry.
 *
 * Live-out: the advanced 16-bit cursor $74/$75 and the accumulator, which is set to the new low byte
 * (sum & 0xff) — the value the next emitter reads back to find where it may write. Grounding: [seen].
 */
export function advanceDisplayCursor(m, y = m.regs.y) {
  const { mem8 } = m;

  // Stride is Y plus one: the +1 is the carry the caller forces set before the 6502 ADC.
  const sum = mem8[DRAW_CURSOR_LO] + y + 1;

  // Store the new low byte of the write head back at $74 (may exceed 0xff; masked on return).
  mem8[DRAW_CURSOR_LO] = sum;

  // On an 8-bit overflow, carry into the high byte $75 so the cursor crosses into the next page.
  if (sum > 0xff) mem8[DRAW_CURSOR_HI] = mem8[DRAW_CURSOR_HI] + 1;

  // Live-out A = the new low byte, masked to a byte; the emitter reads it as the next write offset.
  return (m.regs.a = sum & 0xff);
}
