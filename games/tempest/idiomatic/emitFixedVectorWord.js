// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorWord } from "./emitVectorHeaderWord.js";

/**
 * emitFixedVectorWord -- emit one constant vector word (0x20, 0x80) into the display list. ROM 0xab0d.
 *
 * Role in the machine: Tempest builds every frame as a list of vector words that the AVG (Analog Vector
 * Generator) later walks to draw the tube. Most words carry live geometry, but a few are fixed framing
 * tokens -- this routine emits one such constant pair, used by the text/marker overlay builder
 * (buildTextOverlayList) to punctuate its glyph list with a known control word.
 *
 * Behavior: forwards to the shared emitter emitVectorWord with the immediate low/high byte pair 0x20/0x80.
 * The emitter writes the two bytes through the draw cursor 0x74 and advances that cursor past them, so the
 * next emitted word lands at the following slot.
 *
 * Live-out: two bytes written at the draw cursor 0x74 and the cursor stepped forward two.
 * Grounding: [seen].
 */
export function emitFixedVectorWord(m) {
  return emitVectorWord(m, 0x20, 0x80); // constant word: low byte 0x20, high byte 0x80
}
