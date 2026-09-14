// SPDX-License-Identifier: GPL-3.0-only
import { VG_RECORD_HEADER } from "./names.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";

/**
 * emitVectorWordTag60FromKey — emit a 0x60-tagged vector word keyed by the record-header cell. ROM 0xdf4a.
 *
 * Role in the machine: a thin convenience entry into emitTaggedVectorWord (which tags the high byte
 * with the 0x60 header bits). Where the general routine takes both payload bytes, this one supplies
 * the second byte from the current record-header key cell VG_RECORD_HEADER ($73) — the byte the shape
 * builders stash to carry an object's colour/style attribute — so callers emitting from a shape list
 * need only pass the data byte `a`.
 *
 * Behavior: read VG_RECORD_HEADER ($73) and hand it, with `a`, to emitTaggedVectorWord, which lays
 * the word through the draw cursor ($74). Live-out: one tagged word in the display list, cursor
 * advanced (by the callee). Grounding: [seen]
 */
export function emitVectorWordTag60FromKey(m, a = m.regs.a) {
  const { mem8 } = m;
  return emitTaggedVectorWord(m, a, mem8[VG_RECORD_HEADER]); // second byte from the record-header key $73
}
