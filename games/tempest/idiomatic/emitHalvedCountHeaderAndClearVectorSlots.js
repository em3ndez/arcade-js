// SPDX-License-Identifier: GPL-3.0-only
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { emitVectorHeaderAndClearSlots } from "./emitVectorHeaderAndClearSlots.js";
import { SPINNER_ACCUM } from "./names.js";

/**
 * emitHalvedCountHeaderAndClearVectorSlots -- emit a count-tagged header word, then blank a slot bank.
 * ROM 0xdb6f.
 *
 * Role in the machine: part of the display-list builder. It emits a header word whose payload is a live
 * count -- the spinner accumulator (0x50, the player-controlled rotation counter) halved -- tagged with
 * the 0x68 record type, then hands off to the shared header-emit-and-clear helper to lay a second fixed
 * header and wipe the even slots of the tracked vector bank so the next pass writes into a clean buffer.
 *
 * Behavior: emitTaggedVectorWord writes a 0x68-tagged word carrying SPINNER_ACCUM>>1 (a logical right
 * shift, so the count is scaled to half). Then emitVectorHeaderAndClearSlots(0x33, 0x4e) emits its own
 * header and blanks the four even slots of both 0x60c1 and 0x60d1.
 *
 * Live-out: one tagged word appended at the draw cursor plus whatever the clear helper writes -- a second
 * header word and the two zeroed slot banks. Grounding: [seen].
 */
export function emitHalvedCountHeaderAndClearVectorSlots(m) {
  const { mem8 } = m;
  emitTaggedVectorWord(m, 0x68, mem8[SPINNER_ACCUM] >> 1); // tag 0x68, payload = spinner count / 2
  return emitVectorHeaderAndClearSlots(m, 0x33, 0x4e);      // emit header, blank the even slots
}
