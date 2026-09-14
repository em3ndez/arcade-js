// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorWordTag70 } from "./emitVectorWordTag70.js";

/**
 * emitBlankVectorWordTag70 — emit a $70-tagged vector word carrying a zero data byte. ROM 0xdf6a.
 *
 * Role in the machine: the vector generator's draw stream is a sequence of tagged words. A word with
 * the $70 header and a zero payload is the neutral record-opener the tube, score, and slot drawers put
 * down to begin a fresh draw block before the real coordinate words follow. drawTubeWell calls it to
 * seed each new segment of the well.
 *
 * Behavior: a one-line wrapper — forwards A as the tag-70 word's first byte and a fixed 0x00 as its
 * second (data) byte to the shared emitVectorWordTag70 primitive, which writes the pair through the
 * draw cursor and advances it.
 *
 * Live-out: one two-byte $70-tagged vector word appended at the draw cursor. Grounding: [seen].
 */
export function emitBlankVectorWordTag70(m, a = m.regs.a) {
  return emitVectorWordTag70(m, a, 0x00);
}
