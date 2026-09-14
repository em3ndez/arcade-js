// SPDX-License-Identifier: GPL-3.0-only
import { emitByteAsBcdDigits } from "./emitByteAsBcdDigits.js";

/**
 * emitCappedCount — clamp a count to 99 and emit it as BCD digits. ROM 0xaf71.
 *
 * Role in the machine: the small counters Tempest paints in the corners (the drawCounterPair / drawCounterSlot
 * readouts — Superzapper/spare-life style tallies) are single-byte counts that must never overflow their
 * two-digit field. This helper is the guard between a raw count cell and the digit renderer: it ceilings the
 * value at 0x63 (decimal 99) so a runaway or out-of-range byte still shows as "99" rather than garbage.
 *
 * Behavior: takes the count in a (defaulting to the live 6502 A register), applies Math.min against 0x63,
 * and tail-calls emitByteAsBcdDigits, which packs the clamped value to BCD and appends its two digit glyphs
 * to the display list.
 *
 * Live-out: none of its own; returns whatever emitByteAsBcdDigits returns. Grounding: [seen].
 */
// Clamp the incoming byte to a max of 0x63, then pack-and-emit it.
export function emitCappedCount(m, a = m.regs.a) {
  return emitByteAsBcdDigits(m, Math.min(a, 0x63)); // 0x63 = 99 decimal, the two-digit field ceiling
}
