// SPDX-License-Identifier: GPL-3.0-only
import { emitByteBitsAsDigits } from "./emitByteBitsAsDigits.js";

/**
 * emitByteBitsAsDigitsAtF8 — fixed-slot front for the eight-bit digit emitter. ROM 0xdd29.
 *
 * Role in the machine: Tempest's on-screen bookkeeping (self-test readouts and the debug/status
 * overlays) renders a raw byte as a run of eight per-bit digit glyphs into the vector display list.
 * This entry point is the caller-facing convenience that nails the horizontal placement: it hands the
 * general emitByteBitsAsDigits the screen X coordinate 0xf8 so every caller that wants the run at that
 * fixed column need not repeat the constant.
 *
 * Behavior: pure forwarding. It passes through the byte-to-render (y) and the value byte (a) — both
 * defaulting to the live 6502 registers when omitted, matching the ROM's register-in convention — and
 * appends the literal 0xf8 as the position argument before tail-calling the worker.
 *
 * Live-out: none of its own; whatever emitByteBitsAsDigits writes into the display list and returns is
 * passed straight back. Grounding: [seen].
 */
// Emit the eight-bit digit run with the index preset to the fixed slot.
export function emitByteBitsAsDigitsAtF8(m, y = m.regs.y, a = m.regs.a) {
  return emitByteBitsAsDigits(m, y, a, 0xf8); // 0xf8 = fixed screen-X column for the digit run
}
