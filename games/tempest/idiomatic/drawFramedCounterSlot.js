// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, VG_RECORD_HEADER, loc_9e } from "./names.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { loadSlotCoordBlock } from "./loadSlotCoordBlock.js";
import { emitObjectPositionVector } from "./emitObjectPositionVector.js";
import { emitProjectedSlotRecord } from "./emitProjectedSlotRecord.js";
import { emitCoordDeltaRecord } from "./emitCoordDeltaRecord.js";

/**
 * drawFramedCounterSlot — emit a framed counter element in two color passes. ROM 0xc3ee.
 *
 * Role in the machine: draws a single "framed" element (a counter-style slot with an outline) into
 * the vector display list. The frame effect is produced by drawing the element twice — once at the
 * current slot with its color live, once at the neighbouring slot uncoloured — so the two overlaid
 * projections read as a bordered figure on the tube. Callers pass the slot index in X and the color
 * byte in A (6502 register-style arguments), and the routine returns the stepped-back slot index so
 * a caller can continue walking the slot run.
 *
 * Behavior: caches the color (A) and seats the current slot index (X) into SLOT_LOOP_INDEX (loc_37).
 * Pass one — emits a tagged vector word (tag 0x08, data loc_9e), loads the slot's coordinate block,
 * emits the object position vector (0x61), sets the VG record header (loc_73) to the live color, and
 * emits the projected slot record. It then steps SLOT_LOOP_INDEX back one (u8 wrap). Pass two —
 * clears the header to 0x00 (uncoloured), re-emits the tagged word and projected record at the
 * stepped-back slot. Finally it restores the header to the color, reloads the coordinate block, and
 * emits a coordinate-delta record to close the frame. Returns the stepped-back SLOT_LOOP_INDEX.
 *
 * Live-out: the emitted vector records in the display list, SLOT_LOOP_INDEX (loc_37) left at the
 * stepped-back index, and VG_RECORD_HEADER (loc_73) left holding the color. Grounding: [seen].
 */
export function drawFramedCounterSlot(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  const color = a; // colour passed in A; cached across both passes
  mem8[SLOT_LOOP_INDEX] = x; // seat the slot index (from X) into loc_37
  // Pass one: emit the current slot with the colour live.
  emitTaggedVectorWord(m, 0x08, mem8[loc_9e]);
  loadSlotCoordBlock(m);
  emitObjectPositionVector(m, 0x61);
  mem8[VG_RECORD_HEADER] = color; // header carries the live colour
  emitProjectedSlotRecord(m);
  // Step back one slot and re-emit uncoloured to lay the frame's border.
  mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
  mem8[VG_RECORD_HEADER] = 0x00; // uncoloured pass
  emitTaggedVectorWord(m, 0x08, mem8[loc_9e]);
  emitProjectedSlotRecord(m);
  // Restore the colour and close the frame with a coordinate-delta record.
  mem8[VG_RECORD_HEADER] = color;
  loadSlotCoordBlock(m);
  emitCoordDeltaRecord(m);
  return mem8[SLOT_LOOP_INDEX]; // stepped-back index for the caller's slot walk
}
