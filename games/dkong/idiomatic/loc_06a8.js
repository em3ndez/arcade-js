// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_06a8 — decrement the packed two-digit BCD bonus readout BONUS_DISPLAY by one, latch a
 * "reached zero" marker when it rolls from 01 to 00, store it back, and render it.  ROM 0x06A8.
 *
 * The after-subtract arm of task-entry 10's field render (entry_062a). The counter it steps
 * is BONUS_DISPLAY (0x638C), the on-screen bonus readout. The incoming value is that cell's
 * current byte, holding two decimal digits one per nibble — a packed-BCD reading that is
 * CODE-DERIVED, from the `daa` this routine runs and the nibble split its render tail does,
 * not an observed property of the byte — which the caller has already established is
 * non-zero. This routine takes it one step down: subtract one, decimal-adjust back into
 * valid packed BCD (00 wraps to 99), store the new value into BONUS_DISPLAY, and hand it to
 * the shared field renderer.
 *
 * When the value has just reached zero (it held 01), a one-byte marker is latched into
 * BONUS_DISPLAY_ZEROED (0x63B8) before the adjust — the caller reads that latch to tell the
 * readout has bottomed out.
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
 * LIVE-OUT: memory-only — BONUS_DISPLAY, BONUS_DISPLAY_ZEROED, and the render tail's field
 *           cells / background-music command. The adjusted value also stays in a
 *           register, which the render tail consumes as its input, but no caller reads a
 *           register back after this returns, so the residual registers/flags are dead.
 * NAMES:    BONUS_DISPLAY (0x638C) — the on-screen bonus readout this routine steps and
 *           stores — and BONUS_DISPLAY_ZEROED (0x63B8) — the latch recording that the readout
 *           has bottomed out — both from ram.js.
 *           loc_066a (ROM 0x066A) is direct-called; it reads its digit byte from the register.
 */

import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED } from "./ram.js";
import { loc_066a } from "./loc_066a.js"; // ROM 0x066A — packed-BCD field renderer (the tail join)

export function loc_06a8(m) {
  const { regs, mem } = m;

  // Step the packed BCD counter down by one; this leaves the flags the adjust below reads.
  regs.sub(0x01);

  // Just rolled to zero (the readout held 01): latch the "reached zero" marker.
  if (regs.a === 0) {
    mem.write8(BONUS_DISPLAY_ZEROED, 0x01);
  }

  // Decimal-adjust the decrement back into valid packed BCD (00 wraps to 99).
  regs.daa();

  // Store the new readout value, then render it — the tail reads the digit from the register.
  mem.write8(BONUS_DISPLAY, regs.a);
  loc_066a(m);
}
