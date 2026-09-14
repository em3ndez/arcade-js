// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorWord } from "./emitVectorHeaderWord.js";

/**
 * emitTaggedVectorWord -- lay one vector word into the display list tagged with the 0x60
 * header bits. ROM 0xdf4c.
 *
 * Role in the machine: the vector display is driven by a stream of two-byte words, each with
 * a small opcode tag in its high bits telling the beam hardware what kind of record follows
 * (position, colour/stat, intensity, etc.). This is the emitter for the 0x60-tagged family
 * of words -- the colour/attribute and segment-marker records used all over the frame
 * builders (emitColorStatIfChanged, emitSegmentedSpanBetweenCursors, drawTimedObjectList,
 * bumpLevelEnemyQuota's descendants). Callers pass a payload byte in A and a companion byte
 * in Y; this stamps the header bits onto A and writes the pair.
 *
 * Behaviour: OR the 0x60 tag bits into the A payload, then hand off to emitVectorWord
 * (loc_df57) which stores the first byte (Y payload) at cursor (loc_74)+0, the second byte
 * (tagged A) at +1, and advances the 16-bit cursor two bytes.
 *
 * Live-out: two bytes appended to the display list at (loc_74); the cursor loc_74/loc_75
 * advanced two. Grounding: [seen].
 */
// Emit a vector word: first byte the y payload, second byte the a payload
// tagged with the mid header bits.
export function emitTaggedVectorWord(m, a = m.regs.a, y = m.regs.y) {
  return emitVectorWord(m, y, a | 0x60);      // Y payload first, A tagged with 0x60 header bits second
}
