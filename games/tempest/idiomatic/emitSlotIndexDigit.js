// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { PROJ_Y_LO } from "./names.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

/**
 * emitSlotIndexDigit — advance the slot index and draw it as a one-digit number. ROM 0xaa9e.
 *
 * Role in the machine: when the game numbers slots/columns on screen (e.g. a per-slot label in a display
 * or test layout), it steps the running index one forward and renders the new value as a single glyph.
 * The digit-run emitter reads its source byte from a fixed zeropage pointer, so this routine first
 * publishes the advanced index into that pointer cell.
 *
 * Behavior: increments the incoming index x (wrapping as an 8-bit value via u8) and stores it into
 * PROJ_Y_LO ($61) — the byte the glyph emitter will read. It then calls emitNibbleDigitRun with source
 * 0x61 and length 0x01, which lays that single byte down as its high-then-low nibble glyph words through
 * the draw cursor loc_74.
 *
 * Live-out: PROJ_Y_LO ($61) holding the advanced index, one digit's worth of glyph words in the display
 * list, and the advanced draw cursor loc_74. Grounding: [seen].
 */
export function emitSlotIndexDigit(m, x = m.regs.x) {
  const { mem8 } = m;
  // Step the slot index one forward (8-bit wrap).
  x = u8(x + 1);
  // Publish it into the pointer byte the digit emitter reads from ($61).
  mem8[PROJ_Y_LO] = x;
  // Emit that single byte as a one-entry glyph run.
  return emitNibbleDigitRun(m, 0x61, 0x01);
}
