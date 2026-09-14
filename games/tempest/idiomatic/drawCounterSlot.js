// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_METRIC, loc_2e, COUNT_GLYPH_COORD_TABLE } from "./names.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitFixedVectorWord } from "./emitFixedVectorWord.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitCappedCount } from "./emitCappedCount.js";
import { emitBlankValueRecord } from "./emitBlankValueRecord.js";
import { drawShapeListAtPosition } from "./drawShapeListAtPosition.js";
import { emitSlotIndexDigit } from "./emitSlotIndexDigit.js";

/**
 * drawCounterSlot — draw one counter slot of the paired readout panel. ROM 0xaf3f.
 *
 * Role in the machine: drawCounterPair renders a two-slot counter panel; this is the per-slot worker it
 * calls once for slot 0 and once for slot 1. Each slot is backed by a counter byte in the loc_600
 * (SLOT_METRIC) array indexed by the slot number x. An empty slot (count zero) draws nothing; a live slot
 * is positioned from a ROM coordinate table and emitted as a colour stat, a fixed vector, a positioned
 * count, a blank spacer, a small shape list, and finally the slot's own index digit.
 *
 * Behaviour: read the slot's count from SLOT_METRIC+x; if it is zero, return immediately (nothing drawn).
 * Otherwise stash the slot index in scratch loc_2e and emit the record sequence: a colour stat only if it
 * changed (emitColorStatIfChanged 0x03), a fixed vector word, a scaled coordinate record whose Y comes
 * from the ROM glyph-coordinate table COUNT_GLYPH_COORD_TABLE (loc_af6f) indexed by the slot in loc_2e,
 * the capped count itself, a blank value spacer (0xa0), a two-argument shape-list draw (0x04,0x10), and
 * the slot index digit read back from loc_2e.
 *
 * Live-out: writes scratch loc_2e (the acting slot index, reused as the table index and the trailing
 * digit); appends this slot's vector records to the active display list. Grounding: [seen].
 */
export function drawCounterSlot(m, x = m.regs.x) {
  const { mem8 } = m;
  const count = mem8[u16(SLOT_METRIC + x)];   // this slot's counter byte from the loc_600 array
  if (count === 0) return;                    // empty slot: draw nothing
  mem8[loc_2e] = x;                           // stash slot index; reused below as table index + digit
  emitColorStatIfChanged(m, 0x03);
  emitFixedVectorWord(m);
  // Position from the ROM glyph-coord table (loc_af6f) indexed by this slot, at scale 0xd0.
  emitScaledCoordinateRecord(m, 0xd0, mem8[u16(COUNT_GLYPH_COORD_TABLE + mem8[loc_2e])]);
  emitCappedCount(m, count);                  // the count value itself
  emitBlankValueRecord(m, 0xa0);              // blank spacer record
  drawShapeListAtPosition(m, 0x04, 0x10);
  emitSlotIndexDigit(m, mem8[loc_2e]);        // trailing slot-index digit
}
