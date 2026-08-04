// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBonusDisplayDown — take one notch off the bonus readout the player watches count down: latch
 * a "reached zero" marker if it has bottomed out, store the new value, and redraw it.
 *
 * The readout is a single byte holding two decimal digits, one per nibble. The current value
 * arrives in a register, already known by the caller to be non-zero, and this routine steps it
 * down by one: subtract one, decimal-adjust back into valid packed decimal (00 wraps to 99), store,
 * and hand the new value to the shared two-digit field renderer.
 *
 * When the readout has just reached zero — it held 01 — a marker byte is latched BEFORE the adjust,
 * so a reader elsewhere can tell the bonus has bottomed out rather than merely wrapped.
 *
 * The subtract and the decimal adjust are kept as the machine's own operations because the adjust
 * reads the half-carry, subtract-mode and carry flags that the subtract leaves behind. Only a plain
 * memory write sits between them, and that leaves those flags intact, so the adjust sees exactly
 * the subtract's result.
 *
 * NOT CLAIMED: that this awards or deducts score. It steps the READOUT byte and nothing else; the
 * bonus quantity itself is a separate cell with its own writers.
 *
 * LIVE-OUT: memory-only — the readout byte, the bottomed-out latch, and whatever the render tail
 * writes. The adjusted value is also left in a register, which the render tail takes as its input,
 * but nothing reads a register back once this returns.
 */

import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED } from "./names.js";
import { renderBonusDisplay } from "./renderBonusDisplay.js";

export function stepBonusDisplayDown(m) {
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
  renderBonusDisplay(m);
}
