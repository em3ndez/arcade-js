// SPDX-License-Identifier: GPL-3.0-only
import { PENDING_WORK_FLAGS } from "./names.js";

/**
 * raiseRebuildRequestBits — set the two low request flags in the pending-work cell. ROM 0xac36.
 *
 * Role in the machine: the control-block rebuilder (the code that reshapes the per-lane control/glyph
 * blocks when the operator's option switches change) is edge-triggered. Callers don't rebuild inline;
 * they raise request bits in the pending-work flags cell 0x1c9 and let the rebuild pass drain them. This
 * helper is the primitive that raises both request bits at once — bit0 (copy the template block) and
 * bit1 (fill the ones run) — so the next rebuild will refresh both halves.
 *
 * Behaviour: read the pending-work flags cell 0x1c9, OR in 0x03, write it back, and return the merged
 * value (mirrored into A for the ROM caller that tests it).
 *
 * Live-out: pending-work flags cell 0x1c9 (low two bits set); A = the merged value. Grounding: [seen].
 */
export function raiseRebuildRequestBits(m) {
  const { mem8 } = m;
  const value = mem8[PENDING_WORK_FLAGS] | 0x03; // arm both rebuild-request bits
  mem8[PENDING_WORK_FLAGS] = value;
  return (m.regs.a = value); // ROM returns the merged flags in A
}
