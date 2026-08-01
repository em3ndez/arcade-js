// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_06a8 — decrement the packed two-digit BCD counter by one, latch a "reached zero"
 * marker when it rolls from 01 to 00, store it back, and render it.  ROM 0x06A8.
 *
 * The after-subtract arm of task-entry 10's field render (entry_062a). The incoming value
 * is the counter's current packed BCD byte — two decimal digits, one per nibble — which the
 * caller has already established is non-zero. This routine takes it one step down: subtract
 * one, decimal-adjust back into valid packed BCD (00 wraps to 99), store the new value into
 * the counter's display cell, and hand it to the shared field renderer.
 *
 * When the value has just reached zero (it held 01), a one-byte marker is latched into the
 * engine-scratch cell 0x63B8 before the adjust — the caller reads that cell to tell the
 * counter has bottomed out.
 *
 * The decrement and the decimal-adjust are kept as the machine's own subtract/adjust because
 * the adjust reads the half-carry, subtract-mode, and carry flags the subtract leaves — this
 * is the after-subtract decimal adjust, whose correctness is pinned against MAME. Only a plain
 * memory write sits between them, which leaves those flags intact, so the adjust sees exactly
 * the subtract's result.
 *
 * Memory-equivalent to the frozen oracle — equivalence-06a8.test.js.
 * GATE:     exhaustive — the whole memory effect is a pure function of the incoming counter
 *           byte (this routine and its render tail read no work RAM), so sweeping all 256
 *           values on a real captured base is a proof over both the zero-latch arm and the
 *           ordinary-decrement arm. Backed by real captured 0x06A8 dispatches. Whole-RAM diff
 *           (nothing in the chain writes the stack — the oracle's tail is a jump and the only
 *           return merely pops, so there is no dissolved push to exclude). Teeth: a dropped
 *           decimal adjust, a dropped zero latch, and an always-latch twin.
 * LIVE-OUT: memory-only — the counter cell 0x638C, the zero marker 0x63B8, and the render
 *           tail's field cells / background-music command. The adjusted value also stays in a
 *           register, which the render tail consumes as its input, but no caller reads a
 *           register back after this returns, so the residual registers/flags are dead.
 * NAMES:    none from ram.js. 0x638C (transient two-digit BCD display scratch) and 0x63B8
 *           (the "counter reached zero" marker) are both unnamed engine scratch, kept hex.
 *           loc_066a (ROM 0x066A) is direct-called; it reads its digit byte from the register.
 */

import { loc_066a } from "./loc_066a.js"; // ROM 0x066A — packed-BCD field renderer (the tail join)

const COUNTER_CELL = 0x638c; // transient two-digit BCD display scratch (unnamed in ram.js)
const ZERO_MARKER = 0x63b8;  // latched to 1 when the counter rolls to 00 (unnamed in ram.js)

export function loc_06a8(m) {
  const { regs, mem } = m;

  // Step the packed BCD counter down by one; this leaves the flags the adjust below reads.
  regs.sub(0x01);

  // Just rolled to zero (the counter held 01): latch the "reached zero" marker.
  if (regs.a === 0) {
    mem.write8(ZERO_MARKER, 0x01);
  }

  // Decimal-adjust the decrement back into valid packed BCD (00 wraps to 99).
  regs.daa();

  // Store the new counter value, then render it — the tail reads the digit from the register.
  mem.write8(COUNTER_CELL, regs.a);
  loc_066a(m);
}
