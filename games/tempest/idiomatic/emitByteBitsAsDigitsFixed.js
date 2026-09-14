// SPDX-License-Identifier: GPL-3.0-only
import { emitByteBitsAsDigitsAtF8 } from "./emitByteBitsAsDigitsAtF8.js";

/**
 * emitByteBitsAsDigitsFixed — fully-positioned front for the eight-bit digit emitter. ROM 0xdd27.
 *
 * Role in the machine: the outermost of the byte-bits digit fronts. Where emitByteBitsAsDigitsAtF8 fixes
 * only the horizontal (X = 0xf8), this shell also fixes the value byte, so both display coordinates of the
 * run are locked and the only caller-supplied datum is the byte whose bits are drawn. It is the entry the
 * self-test / status overlays call when they just want "render this byte's eight bits at the fixed spot".
 *
 * Behavior: pure forwarding. It forwards the byte-to-render (y, defaulting to the live 6502 Y register)
 * and injects the constant 0xd0 as the value byte before tail-calling emitByteBitsAsDigitsAtF8, which in
 * turn appends the fixed X = 0xf8. Together the two shells pin the pair (0xd0, 0xf8).
 *
 * Live-out: none of its own; it returns whatever the chained emitter returns. Grounding: [seen].
 */
// Emit the digit run with a fixed value byte.
export function emitByteBitsAsDigitsFixed(m, y = m.regs.y) {
  return emitByteBitsAsDigitsAtF8(m, y, 0xd0); // 0xd0 = fixed value byte; AtF8 adds the fixed X = 0xf8
}
