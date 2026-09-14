// SPDX-License-Identifier: GPL-3.0-only
import { VG_LAST_STAT } from "./names.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";

/**
 * emitScaleWordIfChanged — emit the current slot's scale word only when it has changed. ROM 0xb0dd.
 *
 * Role in the machine: the vector generator carries a running "scale" attribute — the fine (low-nibble)
 * size applied to subsequent strokes. Re-emitting the same scale every record would bloat the display
 * list, so the game caches the last value it wrote in VG_LAST_STAT ($72) and only pushes a fresh scale
 * word when the requested value differs. This is the change-filter in front of that emit.
 *
 * Behavior: compares the argument a (defaulting to the accumulator) against the cached VG_LAST_STAT; if
 * they match, returns immediately with nothing emitted. Otherwise it latches the new value into
 * VG_LAST_STAT and emits it as a 0x70-tagged vector word via emitBlankVectorWordTag70, which writes the
 * scale attribute through the draw cursor loc_74.
 *
 * Live-out: VG_LAST_STAT ($72) updated to a, and (when changed) one new scale word in the display list
 * plus the advanced draw cursor loc_74. Grounding: [seen].
 */
export function emitScaleWordIfChanged(m, a = m.regs.a) {
  const { mem8 } = m;
  // Nothing to do if the scale attribute already matches what was last emitted.
  if (a === mem8[VG_LAST_STAT]) return;
  // Latch the new scale value, then push it as a tagged vector word.
  mem8[VG_LAST_STAT] = a;
  return emitBlankVectorWordTag70(m, a);
}
