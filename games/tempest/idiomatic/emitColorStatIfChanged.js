// SPDX-License-Identifier: GPL-3.0-only
import { loc_9e } from "./names.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";

/**
 * emitColorStatIfChanged — emit the slot colour/intensity attribute only when it changes. ROM 0xb0d1.
 *
 * Role in the machine: as the shape builders walk a slot's vector list they must set the coarse colour /
 * intensity attribute (the high-nibble scale/colour word) for the current object before its strokes are
 * drawn. Re-emitting an unchanged attribute would bloat the vector display list with redundant records, so
 * this routine latches the last value written and skips the emit while it holds steady — a classic
 * change-only-emit optimization shared by drawSlotShapeRecord / expandShapeListToVectors and friends.
 *
 * Behavior: compare the requested attribute y against the latch cell loc_9e (0x009e). If they already
 * match, return without touching the display list. Otherwise store y into loc_9e and emit a tagged vector
 * word with tag 0x08 (the colour/intensity attribute opcode) carrying y as its payload.
 *
 * Live-out: loc_9e holds the newly-latched attribute; on a change, one tag-0x08 record is appended to the
 * vector display list. Grounding: [seen].
 */
// Skip when the latched byte already equals the input; otherwise latch it and
// emit a fixed-tag record built from the input.
export function emitColorStatIfChanged(m, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[loc_9e] === y) return;      // unchanged attribute -> no redundant record
  mem8[loc_9e] = y;                    // latch the new colour/intensity value
  emitTaggedVectorWord(m, 0x08, y);    // tag 0x08 = colour/intensity attribute word
}
